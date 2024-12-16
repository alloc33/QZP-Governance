use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{
        Mint, TokenAccount, MintTo, mint_to, TransferChecked, transfer_checked, TokenInterface,
    },
    associated_token::AssociatedToken,
};

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

    pub fn check_mint_extensions_constraints(
        _ctx: Context<CheckMintExtensionConstraints>,
    ) -> Result<()> {
        Ok(())
    }
}
