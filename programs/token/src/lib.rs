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

    pub fn transfer_spl_tokens(ctx: Context<TransferSplTokens>, amount: u64) -> Result<()> {
        // Construct CPI context for Token2022 transfer
        let cpi_accounts = anchor_spl::token_2022::Transfer {
            from: ctx.accounts.from_ata.to_account_info(),
            to: ctx.accounts.to_ata.to_account_info(),
            authority: ctx.accounts.from_ata.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

        // Perform the token transfer
        anchor_spl::token_2022::transfer(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn check_mint_extensions_constraints(
        _ctx: Context<CheckMintExtensionConstraints>,
    ) -> Result<()> {
        Ok(())
    }
}
