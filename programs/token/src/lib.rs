use anchor_lang::prelude::*;

pub mod instructions;
pub mod utils;
pub use instructions::*;
pub use utils::*;

declare_id!("4wYyKpdmL82mehsRdiTCTbCnGCBZjdgbz6vE8J46VQFn");

#[program]
pub mod token_extensions {
    use super::*;

    pub fn create_mint_account(
        ctx: Context<CreateMintAccount>,
        args: CreateMintAccountArgs,
    ) -> Result<()> {
        instructions::handler(ctx, args)
    }

    pub fn transfer_qzl_tokens(ctx: Context<TransferQZLTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = anchor_spl::token_2022::TransferChecked {
            mint: ctx.accounts.mint.to_account_info(), // Explicitly include mint account
            from: ctx.accounts.from_ata.to_account_info(),
            to: ctx.accounts.to_ata.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(), // Must match `from_ata` authority
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

        anchor_spl::token_2022::transfer_checked(cpi_ctx, amount, 0 /* decimals */)?;

        Ok(())
    }

    pub fn check_mint_extensions_constraints(
        _ctx: Context<CheckMintExtensionConstraints>,
    ) -> Result<()> {
        Ok(())
    }
}
