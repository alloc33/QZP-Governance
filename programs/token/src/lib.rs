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

    pub fn mint_to_account(ctx: Context<MintTo>, amount: u64) -> Result<()> {
        instructions::mint_to(ctx, amount)
    }

    pub fn check_mint_extensions_constraints(
        _ctx: Context<CheckMintExtensionConstraints>,
    ) -> Result<()> {
        Ok(())
    }
}
