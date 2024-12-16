use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction::transfer},
};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

declare_id!("Di7sLAGVcawC6Wqat2KRacKHQFF2S4RfyGPTCQBJoET3");

// Specify your (admin's) public key assuming that your private key is in PATH (e.g.
// ~/.config/solana/id.json)
const ADMIN_PUBKEY: &str = "2vJe2h4WnJiemMq7v6qu6zacunspeRqx8VPq6ZhjyA5X";

#[program]
mod vote_project {
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

    // WARN: Ensure idx is unique across rounds. Currently, it is possible to reuse the same idx in
    // different rounds, which may cause confusion.
    pub fn add_project(ctx: Context<NewVoteProject>, idx: String) -> Result<()> {
        ctx.accounts.project_data.vote_manager = ctx.accounts.vote_manager.admin;
        ctx.accounts.project_data.idx = idx;
        ctx.accounts.project_data.vote_count = 0;
        ctx.accounts.project_data.vote_round = ctx.accounts.vote_manager.vote_round;
        ctx.accounts.project_data.vote_fee = ctx.accounts.vote_manager.vote_fee;

        msg!("Admin init {}", ctx.accounts.vote_manager.admin);
        Ok(())
    }

    pub fn do_vote(ctx: Context<Vouter>, round: u8) -> Result<()> {
        // Check if the voter has already voted in this round
        require!(
            ctx.accounts.vouter_data.last_voted_round < ctx.accounts.vote_manager.vote_round,
            VoteError::AlreadyVoted
        );

        // Ensure that the round matches the current active round
        require!(
            ctx.accounts.vote_manager.vote_round == round,
            VoteError::WrongRound
        );

        if ctx.accounts.vote_manager.vote_round == round {
            let my_account = &ctx.accounts.token; // Light level type tokenaccount
            ctx.accounts.project.vote_count += my_account.amount;
            ctx.accounts.vouter_data.vote_count += my_account.amount;
            ctx.accounts.vouter_data.last_voted_round = ctx.accounts.project.vote_round;
            ctx.accounts.vouter_data.vouter = ctx.accounts.signer.key();
            ctx.accounts.vouter_data.project_name = (*ctx.accounts.project.name).to_string();
            msg!(
                "{} voted for {}, {} voutes",
                ctx.accounts.signer.key(),
                ctx.accounts.project.name,
                my_account.amount
            );
            let voting_fee_transfer = transfer(
                &ctx.accounts.signer.key(),
                &ctx.accounts.admin_for_fee.key(),
                ctx.accounts.project.vote_fee,
            );
            invoke(
                &voting_fee_transfer,
                &[
                    ctx.accounts.signer.to_account_info(),
                    ctx.accounts.admin_for_fee.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
            msg!("Fee transfer to {}", ctx.accounts.admin_for_fee.key());
        } else {
            msg!("Wrong vote round {}", round);
        }

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
    #[instruction(round:u8)]
    pub struct Vouter<'info> {
        #[account(
        init,
        payer = signer,
        space = 8 + VouterData::INIT_SPACE,
        // These seeds ensure that a voter (signer.key()) cannot create duplicate accounts for the
        // same round.
        seeds = [
            b"vouter",                  // Fixed prefix for vouter data
            &[round,1,1,1,1,1],          // Use round as a single-byte slice
            signer.key().as_ref()       // Voter's wallet for uniqueness
        ],
        bump
        )]
        pub vouter_data: Account<'info, VouterData>,
        #[account(mut)]
        pub signer: Signer<'info>,
        #[account(mut)]
        pub vote_manager: Account<'info, VoteManager>,
        #[account(mut)]
        /// CHECK: This is not dangerous because we don't read or write from this account
        pub admin_for_fee: UncheckedAccount<'info>,
        #[account(mut)]
        pub project: Account<'info, ProjectData>,
        pub mint: InterfaceAccount<'info, Mint>,
        pub token: InterfaceAccount<'info, TokenAccount>,
        pub token_program: Interface<'info, TokenInterface>,
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
        #[msg("You have already voted in this round.")]
        AlreadyVoted,
        #[msg("Wrong vote round.")]
        WrongRound,
        #[msg("Admin account already initialized")]
        DoubleInitAttempt,
    }
}

// Helper function
// fn pad_round(round: u8) -> [u8; 6] {
//     let mut padded = [0u8; 6];
//     padded[0] = round; // Place the round value at the first position
//     padded
// }
