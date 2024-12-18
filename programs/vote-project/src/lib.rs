use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer},
};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

declare_id!("Di7sLAGVcawC6Wqat2KRacKHQFF2S4RfyGPTCQBJoET3");

const ADMIN_PUBKEY: &str = "2vJe2h4WnJiemMq7v6qu6zacunspeRqx8VPq6ZhjyA5X";

#[program]
mod vote_project {
    // use anchor_spl::token::TransferChecked;

    use anchor_spl::token_2022::{
        spl_token_2022::{instruction::AuthorityType, onchain::invoke_transfer_checked},
        SetAuthority,
    };

    use super::*;

    pub fn initialize(
        ctx: Context<Admin>,
        token_mint: Pubkey,
        token_program: Pubkey,
        init_vote_fee: u64,
    ) -> Result<()> {
        let trusted_admin_pubkey = Pubkey::try_from(ADMIN_PUBKEY);

        msg!("Pubkey hard {:#?}", trusted_admin_pubkey);
        msg!("Pubkey ctx {}", ctx.accounts.owner.key());

        require!(
            trusted_admin_pubkey == Ok(ctx.accounts.owner.key()),
            VoteError::NotAdmin
        );

        require!(
            ctx.accounts.vote_data.admin == Pubkey::default(),
            VoteError::DoubleInitAttempt
        );

        ctx.accounts.vote_data.vote_round = 1;
        ctx.accounts.vote_data.admin = ctx.accounts.owner.key();
        ctx.accounts.vote_data.tk_mint = token_mint;
        ctx.accounts.vote_data.tk_program = token_program;
        ctx.accounts.vote_data.vote_fee = init_vote_fee;

        msg!("Vote program with admin: initialize!"); // Message will show up in the tx logs
        msg!("Round: 1");
        Ok(())
    }

    pub fn increment_round(ctx: Context<Admin>) -> Result<()> {
        ctx.accounts.vote_data.vote_round += 1;
        msg!(
            "New round is started: {}",
            &ctx.accounts.vote_data.vote_round
        );
        Ok(())
    }

    pub fn change_fee(ctx: Context<Admin>, new_vote_fee: u64) -> Result<()> {
        if ctx.accounts.owner.key() == ctx.accounts.vote_data.admin {
            ctx.accounts.vote_data.vote_fee = new_vote_fee;
            msg!("Fee is changed {}", ctx.accounts.vote_data.vote_fee);
        } else {
            msg!("You are not admin {}", ctx.accounts.owner.key());
        }
        Ok(())
    }

    pub fn add_project(ctx: Context<NewVoteProject>, idx: String) -> Result<()> {
        ctx.accounts.project_data.vote_manager = ctx.accounts.vote_manager.admin;
        ctx.accounts.project_data.idx = idx;
        ctx.accounts.project_data.vote_count = 0;
        ctx.accounts.project_data.vote_round = ctx.accounts.vote_manager.vote_round;
        ctx.accounts.project_data.vote_fee = ctx.accounts.vote_manager.vote_fee;

        msg!("Admin init {}", ctx.accounts.vote_manager.admin);
        Ok(())
    }

    // We're using `round` to check project_data PDA in account constraints
    pub fn do_vote(ctx: Context<Vouter>, _round: u8) -> Result<()> {
        // Ensure the voter has sufficient tokens for the vote fee
        require!(
            ctx.accounts.token.amount >= ctx.accounts.vote_manager.vote_fee,
            VoteError::InsufficientTokens
        );

        // Ensure the mint matches between the voter's token account and the vote fee account
        require!(
            ctx.accounts.admin_for_fee.mint == ctx.accounts.mint.key(),
            VoteError::WrongMint
        );

        // Increment vote counts for the project and voter
        ctx.accounts.project.vote_count += 1;
        ctx.accounts.vouter_data.vote_count += 1;
        ctx.accounts.vouter_data.last_voted_round = ctx.accounts.project.vote_round;
        ctx.accounts.vouter_data.vouter = ctx.accounts.signer.key();
        ctx.accounts.vouter_data.project_name = (*ctx.accounts.project.idx).to_string();

        msg!(
            "{} voted for {}, total votes: {}",
            ctx.accounts.signer.key(),
            ctx.accounts.project.idx,
            ctx.accounts.project.vote_count
        );

        // Transfer the voting fee from the voter's token account to the admin's fee account
        let cpi_accounts = anchor_spl::token_interface::TransferChecked {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.token.to_account_info(),
            to: ctx.accounts.admin_for_fee.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(), /* The voter must sign for this
                                                               * transfer */
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

        // Transfer the vote fee (amount = vote_fee)
        anchor_spl::token_interface::transfer_checked(
            cpi_ctx,
            ctx.accounts.vote_manager.vote_fee,
            0,
        )?;

        Ok(())
    }

    #[derive(Accounts)]
    pub struct Admin<'info> {
        #[account(
            init_if_needed,
            payer = owner,
            space = 8 + VoteManager::INIT_SPACE,
            seeds = [
                b"vote_manager",
                owner.key().as_ref()
            ],
            bump
        )]
        pub vote_data: Account<'info, VoteManager>,
        #[account(mut)]
        pub owner: Signer<'info>,
        pub system_program: Program<'info, System>,
    }

    #[derive(Accounts)]
    #[instruction(idx:String)]
    pub struct NewVoteProject<'info> {
        #[account(
            // Constrained to unique PDA address.
            init,
            payer = owner,
            space = 8 + ProjectData::INIT_SPACE,
            seeds = [
                idx.as_bytes(),                         // Project identifier
                &vote_manager.vote_round.to_le_bytes(), // Round number ensures uniqueness
                owner.key().as_ref()                    // Admin's public key
            ],
            bump)]
        pub project_data: Account<'info, ProjectData>,
        #[account(
            mut,
            constraint = vote_manager.admin == owner.key()
        )]
        pub vote_manager: Account<'info, VoteManager>,
        #[account(mut)]
        pub owner: Signer<'info>,
        pub system_program: Program<'info, System>,
    }

    #[derive(Accounts)]
    #[instruction(round: u8)]
    pub struct Vouter<'info> {
        #[account(
        init,
        payer = signer,
        space = 8 + VouterData::INIT_SPACE,
        seeds = [
            b"vouter",
            &[round, 1, 1, 1, 1, 1], // Use round as a single-byte slice
            signer.key().as_ref()     // Voter's wallet for uniqueness
        ],
        bump
        )]
        pub vouter_data: Account<'info, VouterData>,
        #[account(mut)]
        pub signer: Signer<'info>, // The voter's wallet (authority for token transfer)
        #[account(mut)]
        pub vote_manager: Account<'info, VoteManager>, // Vote manager account
        #[account(mut)]
        pub admin_for_fee: InterfaceAccount<'info, TokenAccount>,
        #[account(mut)]
        pub project: Account<'info, ProjectData>, // Project being voted for
        pub mint: InterfaceAccount<'info, Mint>, // Token mint for QZL
        #[account(mut)]
        pub token: InterfaceAccount<'info, TokenAccount>, // Voter's token account (source)
        pub token_program: Interface<'info, TokenInterface>, // Token program interface
        pub system_program: Program<'info, System>,
    }

    #[account]
    #[derive(InitSpace)]
    pub struct VoteManager {
        admin: Pubkey,
        tk_mint: Pubkey,
        tk_program: Pubkey,
        vote_round: u8,
        vote_fee: u64,
    }

    #[account]
    #[derive(InitSpace)]
    pub struct ProjectData {
        vote_manager: Pubkey,
        #[max_len(50)]
        idx: String,
        #[max_len(50)]
        name: String,
        vote_round: u8,
        vote_count: u64,
        vote_fee: u64,
    }
    #[account]
    #[derive(InitSpace)]
    pub struct VouterData {
        vouter: Pubkey,
        #[max_len(50)]
        project_name: String,
        last_voted_round: u8,
        vote_count: u64,
    }

    #[error_code]
    pub enum VoteError {
        #[msg("Vote program with admin: do not initialize!")]
        NotAdmin,
        #[msg("Wrong vote round.")]
        WrongRound,
        #[msg("Admin account already initialized.")]
        DoubleInitAttempt,
        #[msg("Not enough QZL tokens")]
        InsufficientTokens,
        #[msg("WrongMint")]
        WrongMint,
    }
}
