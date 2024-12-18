use anchor_lang::{prelude::*, solana_program::entrypoint::ProgramResult};

use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::spl_token_2022::extension::{
        group_member_pointer::GroupMemberPointer, metadata_pointer::MetadataPointer,
        mint_close_authority::MintCloseAuthority, permanent_delegate::PermanentDelegate,
    },
    token_interface::{
        spl_token_metadata_interface::state::TokenMetadata, token_metadata_initialize, Mint,
        Token2022, TokenAccount, TokenInterface, TokenMetadataInitialize,
    },
};
use spl_pod::optional_keys::OptionalNonZeroPubkey;

use crate::{
    get_meta_list_size, get_mint_extensible_extension_data, get_mint_extension_data,
    update_account_lamports_to_minimum_balance, META_LIST_ACCOUNT_SEED,
};

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct CreateMintAccountArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub initial_supply: u64,
}

#[derive(Accounts)]
pub struct MintTo<'info> {
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(signer)]
    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(args: CreateMintAccountArgs)]
pub struct CreateMintAccount<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    /// CHECK: can be any account
    pub authority: Signer<'info>,
    #[account()]
    /// CHECK: can be any account
    pub receiver: UncheckedAccount<'info>,
    #[account(
        init,
        signer,
        payer = payer,
        mint::token_program = token_program,
        mint::decimals = 0,
        mint::authority = authority,
        mint::freeze_authority = authority,
        extensions::metadata_pointer::authority = authority,
        extensions::metadata_pointer::metadata_address = mint,
        extensions::group_member_pointer::authority = authority,
        extensions::group_member_pointer::member_address = mint,
        extensions::close_authority::authority = authority,
        extensions::permanent_delegate::delegate = authority,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init,
        payer = payer,
        associated_token::token_program = token_program,
        associated_token::mint = mint,
        associated_token::authority = receiver,
    )]
    pub mint_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: This account's data is a buffer of TLV data
    #[account(
        init,
        space = get_meta_list_size(None),
        seeds = [META_LIST_ACCOUNT_SEED, mint.key().as_ref()],
        bump,
        payer = payer,
    )]
    pub extra_metas_account: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token2022>,
}

impl<'info> CreateMintAccount<'info> {
    fn initialize_token_metadata(
        &self,
        name: String,
        symbol: String,
        uri: String,
    ) -> ProgramResult {
        let cpi_accounts = TokenMetadataInitialize {
            token_program_id: self.token_program.to_account_info(),
            mint: self.mint.to_account_info(),
            metadata: self.mint.to_account_info(), /* metadata account is the mint, since data is
                                                    * stored in mint */
            mint_authority: self.authority.to_account_info(),
            update_authority: self.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);
        token_metadata_initialize(cpi_ctx, name, symbol, uri)?;
        Ok(())
    }
}

pub fn handler(ctx: Context<CreateMintAccount>, args: CreateMintAccountArgs) -> Result<()> {
    // Initialize token metadata
    msg!("Initializing token metadata...");
    ctx.accounts.initialize_token_metadata(
        args.name.clone(),
        args.symbol.clone(),
        args.uri.clone(),
    )?;
    msg!("Token metadata initialized.");

    // Reload mint account to ensure it's updated
    ctx.accounts.mint.reload()?;
    let mint_data = &mut ctx.accounts.mint.to_account_info();

    // Retrieve and verify token metadata
    let metadata = get_mint_extensible_extension_data::<TokenMetadata>(mint_data)?;
    assert_eq!(metadata.mint, ctx.accounts.mint.key());
    assert_eq!(metadata.name, args.name);
    assert_eq!(metadata.symbol, args.symbol);
    assert_eq!(metadata.uri, args.uri);
    msg!("Token metadata verified.");

    // Verify MetadataPointer extension
    let metadata_pointer = get_mint_extension_data::<MetadataPointer>(mint_data)?;
    let mint_key: Option<Pubkey> = Some(ctx.accounts.mint.key());
    let authority_key: Option<Pubkey> = Some(ctx.accounts.authority.key());
    assert_eq!(
        metadata_pointer.metadata_address,
        OptionalNonZeroPubkey::try_from(mint_key)?
    );
    assert_eq!(
        metadata_pointer.authority,
        OptionalNonZeroPubkey::try_from(authority_key)?
    );
    msg!("MetadataPointer extension verified.");

    // Verify PermanentDelegate extension
    let permanent_delegate = get_mint_extension_data::<PermanentDelegate>(mint_data)?;
    assert_eq!(
        permanent_delegate.delegate,
        OptionalNonZeroPubkey::try_from(authority_key)?
    );
    msg!("PermanentDelegate extension verified.");

    // Verify MintCloseAuthority extension
    let close_authority = get_mint_extension_data::<MintCloseAuthority>(mint_data)?;
    assert_eq!(
        close_authority.close_authority,
        OptionalNonZeroPubkey::try_from(authority_key)?
    );
    msg!("MintCloseAuthority extension verified.");

    // Verify GroupMemberPointer extension
    let group_member_pointer = get_mint_extension_data::<GroupMemberPointer>(mint_data)?;
    assert_eq!(
        group_member_pointer.authority,
        OptionalNonZeroPubkey::try_from(authority_key)?
    );
    assert_eq!(
        group_member_pointer.member_address,
        OptionalNonZeroPubkey::try_from(mint_key)?
    );
    msg!("GroupMemberPointer extension verified.");

    // **Mint the Initial Supply to Receiver's ATA using Token-2022 CPI**
    msg!("Minting initial supply to receiver's ATA...");
    let cpi_accounts_mint_to = anchor_spl::token_2022::MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.mint_token_account.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };

    let cpi_ctx_mint_to = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts_mint_to,
    );

    anchor_spl::token_2022::mint_to(cpi_ctx_mint_to, args.initial_supply)?;
    msg!("Initial supply minted.");

    // **Revoke Mint Authority to Fix the Total Supply**
    msg!("Revoking mint authority...");
    let cpi_accounts_set_authority = anchor_spl::token_2022::SetAuthority {
        account_or_mint: ctx.accounts.mint.to_account_info(),
        current_authority: ctx.accounts.authority.to_account_info(),
    };

    let cpi_ctx_set_authority = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts_set_authority,
    );

    anchor_spl::token_2022::set_authority(
        cpi_ctx_set_authority,
        anchor_spl::token_2022::spl_token_2022::instruction::AuthorityType::MintTokens,
        None,
    )?;
    msg!("Mint authority revoked.");

    // **Update Lamports to Minimum Balance**
    msg!("Updating lamports to minimum balance...");
    update_account_lamports_to_minimum_balance(
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    )?;
    msg!("Lamports updated to minimum balance.");

    Ok(())
}

#[derive(Accounts)]
pub struct TransferSplTokens<'info> {
    #[account(mut)]
    pub from_ata: Box<InterfaceAccount<'info, TokenAccount>>, // The mint's token account
    #[account(mut)]
    pub to_ata: Box<InterfaceAccount<'info, TokenAccount>>, // The recipient's token account
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
#[instruction()]
pub struct CheckMintExtensionConstraints<'info> {
    #[account(mut)]
    /// CHECK: can be any account
    pub authority: Signer<'info>,
    #[account(
        extensions::metadata_pointer::authority = authority,
        extensions::metadata_pointer::metadata_address = mint,
        extensions::group_member_pointer::authority = authority,
        extensions::group_member_pointer::member_address = mint,
        extensions::close_authority::authority = authority,
        extensions::permanent_delegate::delegate = authority,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
}

#[error_code]
pub enum QZLTokenError {
    #[msg("Unable to initialize token mint")]
    UnableToInitializeMint,
}
