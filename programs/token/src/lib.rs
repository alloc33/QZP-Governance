use anchor_lang::prelude::*;

// Importing instruction handlers and utility functions.
pub mod instructions;
pub mod utils;
pub use instructions::*;
pub use utils::*;

// Declare the program ID to associate this Rust program with the deployed Solana program.
declare_id!("4wYyKpdmL82mehsRdiTCTbCnGCBZjdgbz6vE8J46VQFn");

#[program]
pub mod token_extensions {
    use super::*;

    /// Initializes a new mint account with specified parameters.
    /// This sets up the token with its metadata and initial supply.
    pub fn create_mint_account(
        ctx: Context<CreateMintAccount>,
        args: CreateMintAccountArgs,
    ) -> Result<()> {
        instructions::handler(ctx, args)
    }

    /// Transfers a specified amount of QZL tokens from one admin's token accounnt to another.
    /// Utilizes the Token-2022 program's CPI to ensure safe and verified transfers.
    pub fn transfer_qzl_tokens(ctx: Context<TransferQZLTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = anchor_spl::token_2022::TransferChecked {
            mint: ctx.accounts.mint.to_account_info(), /* The token mint associated with the
                                                        * transfer. */
            from: ctx.accounts.from_ata.to_account_info(), // Source token account.
            to: ctx.accounts.to_ata.to_account_info(),     // Destination token account.
            authority: ctx.accounts.authority.to_account_info(), /* Must be the authority of the
                                                            * source account. */
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

        // Execute the transfer with zero decimals as specified.
        anchor_spl::token_2022::transfer_checked(cpi_ctx, amount, 0 /* decimals */)?;

        Ok(())
    }

    /// Placeholder function to check constraints related to mint extensions.
    /// Currently, it performs no operations but can be expanded to include validation logic.
    pub fn check_mint_extensions_constraints(
        _ctx: Context<CheckMintExtensionConstraints>,
    ) -> Result<()> {
        Ok(())
    }
}
