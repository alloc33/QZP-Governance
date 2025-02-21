use std::{env, error::Error, rc::Rc};

use anchor_client::{
    solana_client::nonblocking::rpc_client::RpcClient,
    solana_sdk::{pubkey::Pubkey, signature::read_keypair_file, system_program},
    Client, Cluster,
};

use anchor_client::{
    solana_client::{
        client_error::ClientErrorKind::RpcError,
        rpc_request::{RpcError as SolanaRpcError, RpcResponseErrorData},
    },
    solana_sdk::signature::{Keypair, Signer},
    ClientError::SolanaClientError,
};

const GOVERNANCE_PROGRAM_ID: &str = "CrJY78Q5h6xFUVD75mGGS5n3ECxWddtGUBYvTYE8pfjb";
const TOKEN_MINT: &str = "6aqFDLo8MHxFzKTeNfaCbntjNg4r5tLWSyGo3fUAki3f";
const TOKEN_PROGRAM: &str = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ASSOCIATED_TOKEN_PROGRAM: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage:");
        eprintln!("  {} initialize_voting", args[0]);
        eprintln!("  {} add_project <project_key>", args[0]);
        eprintln!("  {} change_fee <new_fee>", args[0]);
        eprintln!("  {} get_round", args[0]);
        eprintln!("  {} increment_round", args[0]);
        eprintln!("  {} do_vote <project_name> <voter_keypair>", args[0]);
        eprintln!("  {} get_fee", args[0]);
        eprintln!("  {} get_vote_count", args[0]);
        return Ok(());
    }

    let admin_keypair = get_keypair(&admin_secret())?;
    let cluster = network()?;

    match args[1].as_str() {
        "initialize_voting" => initialize_voting(admin_keypair, cluster).await?,
        "change_fee" => {
            if args.len() < 3 {
                eprintln!("Usage: {} change_fee <new_fee>", args[0]);
                return Ok(());
            }
            let new_fee = args[2].parse::<u64>()?;
            change_fee(new_fee, admin_keypair, cluster).await?;
        }
        "get_round" => {
            get_round(admin_keypair, cluster).await?;
        }
        "increment_round" => {
            increment_round(admin_keypair, cluster).await?;
        }
        "add_project" => {
            if args.len() < 3 {
                eprintln!("Usage: {} add_project <project_key>", args[0]);
                return Ok(());
            }
            let project_key = &args[2];
            add_project(project_key, admin_keypair, cluster).await?;
        }
        "do_vote" => {
            if args.len() < 4 {
                eprintln!("Usage: {} do_vote <project_name> <voter_keypair>", args[0]);
                return Ok(());
            }
            let project_key = &args[2];
            let voter_keypair = get_keypair(&args[3])?;
            do_vote(project_key, admin_keypair, voter_keypair, cluster).await?;
        }
        "get_fee" => {
            get_fee(admin_keypair, cluster).await?;
        }
        "get_vote_count" => {
            if args.len() < 3 {
                eprintln!("Usage: {} get_vote_count <project_key>", args[0]);
                return Ok(());
            }
            let project_key = &args[2];
            get_vote_count(project_key, admin_keypair, cluster).await?;
        }
        other => {
            eprintln!("Unknown command: {}", other);
        }
    }

    Ok(())
}

async fn initialize_voting(admin_keypair: Keypair, cluster: Cluster) -> Result<(), Box<dyn Error>> {
    let payer = Rc::new(admin_keypair);
    let client = Client::new(cluster, payer.clone());
    let governance_program_pubkey = GOVERNANCE_PROGRAM_ID.parse::<Pubkey>()?;
    let program = client.program(governance_program_pubkey)?;

    let (vote_data_pda, _) = derive_vote_manager_pda(&program.payer(), &program.id());

    let send_res = program
        .request()
        .accounts(governance::accounts::Admin {
            vote_data: vote_data_pda,
            owner: program.payer(),
            system_program: system_program::ID,
        })
        .args(governance::instruction::Initialize {
            token_mint: TOKEN_MINT.parse()?,
            token_program: TOKEN_PROGRAM.parse()?,
            init_vote_fee: 100,
        })
        .signer(&*payer)
        .send()
        .await;

    match send_res {
        Ok(sig) => println!("Success! Transaction signature: {sig}"),
        Err(e) => print_transaction_logs(&e),
    }

    Ok(())
}

async fn change_fee(
    new_fee: u64,
    admin_keypair: Keypair,
    cluster: Cluster,
) -> Result<(), Box<dyn Error>> {
    let payer = Rc::new(admin_keypair);
    let client = Client::new(cluster, payer.clone());

    let governance_program_pubkey = GOVERNANCE_PROGRAM_ID.parse::<Pubkey>()?;
    let program = client.program(governance_program_pubkey)?;

    let (vote_data_pda, _) = derive_vote_manager_pda(&program.payer(), &program.id());

    let send_res = program
        .request()
        .accounts(governance::accounts::Admin {
            vote_data: vote_data_pda,
            owner: program.payer(),
            system_program: system_program::ID,
        })
        .args(governance::instruction::ChangeFee {
            new_vote_fee: new_fee,
        })
        .signer(&*payer)
        .send()
        .await;

    match send_res {
        Ok(sig) => println!("Success! Fee changed. Tx signature: {sig}"),
        Err(e) => print_transaction_logs(&e),
    }

    Ok(())
}

async fn get_round(admin_keypair: Keypair, cluster: Cluster) -> Result<(), Box<dyn Error>> {
    let payer = Rc::new(admin_keypair);
    let client = Client::new(cluster, payer.clone());

    let governance_program_pubkey = GOVERNANCE_PROGRAM_ID.parse::<Pubkey>()?;
    let program = client.program(governance_program_pubkey)?;

    let (vote_data_pda, _) = derive_vote_manager_pda(&program.payer(), &program.id());

    let vote_manager: governance::instructions::VoteManager =
        program.account(vote_data_pda).await?;
    let current_round = vote_manager.vote_round;

    println!("Current round: {current_round}");

    Ok(())
}

async fn increment_round(admin_keypair: Keypair, cluster: Cluster) -> Result<(), Box<dyn Error>> {
    let payer = Rc::new(admin_keypair);
    let client = Client::new(cluster, payer.clone());

    let governance_program_pubkey = GOVERNANCE_PROGRAM_ID.parse::<Pubkey>()?;
    let program = client.program(governance_program_pubkey)?;

    let (vote_data_pda, _) = derive_vote_manager_pda(&program.payer(), &program.id());

    let send_res = program
        .request()
        .accounts(governance::accounts::Admin {
            vote_data: vote_data_pda,
            owner: program.payer(),
            system_program: system_program::ID,
        })
        .args(governance::instruction::IncrementRound)
        .signer(&*payer)
        .send()
        .await;

    match send_res {
        Ok(sig) => println!("Success! Round incremented. Tx signature: {sig}"),
        Err(e) => print_transaction_logs(&e),
    }

    Ok(())
}

async fn add_project(
    project_key: &str,
    admin_keypair: Keypair,
    cluster: Cluster,
) -> Result<(), Box<dyn Error>> {
    let payer = Rc::new(admin_keypair);
    let client = Client::new(cluster, payer.clone());

    let governance_program_pubkey = GOVERNANCE_PROGRAM_ID.parse::<Pubkey>()?;
    let program = client.program(governance_program_pubkey)?;

    let (vote_data_pda, _) = derive_vote_manager_pda(&program.payer(), &program.id());

    let vote_manager: governance::instructions::VoteManager =
        program.account(vote_data_pda).await?;
    let current_round = vote_manager.vote_round;

    let (project_data_pda, _project_bump) =
        derive_project_pda(project_key, current_round, &program.payer(), &program.id());

    let send_res = program
        .request()
        .accounts(governance::accounts::NewVoteProject {
            project_data: project_data_pda,
            vote_manager: vote_data_pda,
            owner: program.payer(),
            system_program: system_program::ID,
        })
        .args(governance::instruction::AddProject {
            id: project_key.to_owned(),
        })
        .signer(&*payer)
        .send()
        .await;

    match send_res {
        Ok(sig) => println!("Success! Project added. Tx signature: {sig}"),
        Err(e) => print_transaction_logs(&e),
    }

    Ok(())
}

async fn do_vote(
    project_key: &str,
    admin_keypair: Keypair,
    voter_keypair: Keypair,
    cluster: Cluster,
) -> Result<(), Box<dyn Error>> {
    let payer = Rc::new(admin_keypair);
    let voter = Rc::new(voter_keypair);
    let client = Client::new(cluster.clone(), payer.clone());

    let governance_program_pubkey = GOVERNANCE_PROGRAM_ID.parse::<Pubkey>()?;
    let program = client.program(governance_program_pubkey)?;

    let (vote_manager_pda, _) = derive_vote_manager_pda(&program.payer(), &program.id());

    let vote_manager: governance::instructions::VoteManager =
        program.account(vote_manager_pda).await?;
    let current_round = vote_manager.vote_round;

    let (voter_pda, _) =
        derive_voter_pda(current_round, &voter.pubkey(), &program.id(), project_key);

    let (project_data_pda, _project_bump) =
        derive_project_pda(project_key, current_round, &program.payer(), &program.id());

    let admin_token_account =
        anchor_spl::associated_token::get_associated_token_address_with_program_id(
            &program.payer(),
            &TOKEN_MINT.parse::<Pubkey>()?,
            &TOKEN_PROGRAM.parse::<Pubkey>()?,
        );

    let voter_ata = anchor_spl::associated_token::get_associated_token_address_with_program_id(
        &voter.pubkey(),
        &TOKEN_MINT.parse::<Pubkey>()?,
        &TOKEN_PROGRAM.parse::<Pubkey>()?,
    );

    let vote_manager: governance::instructions::VoteManager =
        program.account(vote_manager_pda).await?;

    let vote_fee = vote_manager.vote_fee;

    let rpc_client = RpcClient::new(cluster.url().to_string());

    match cluster {
        Cluster::Mainnet => {}
        _ => {
            let threshold = 10_000_000_000;
            let current_balance = rpc_client.get_balance(&voter.pubkey()).await?;
            println!("Current voter balance is: {} lamports", current_balance);

            if current_balance < threshold {
                let airdrop_amount = threshold; // or any amount you want
                println!(
                    "Balance is below threshold; requesting an airdrop of {} lamports for voter: \
                     {}",
                    airdrop_amount,
                    voter.pubkey()
                );

                let signature = rpc_client
                    .request_airdrop(&voter.pubkey(), airdrop_amount)
                    .await?;
                rpc_client.confirm_transaction(&signature).await?;

                println!(
                    "Airdrop confirmed. New balance will be at least {} lamports.",
                    threshold
                );

                println!("Waiting for balance to update...");
                tokio::time::sleep(std::time::Duration::from_secs(7)).await;
            }
        }
    }

    println!("Payer Pubkey: {}", payer.pubkey());
    println!("Mint Pubkey: {}", TOKEN_MINT);
    println!("Admin Token Account: {}", admin_token_account);
    println!("Voter ATA: {}", voter_ata);

    let send_res = program
        .request()
        .accounts(governance::accounts::EnsureCanVote {
            signer: voter.pubkey(),
            admin_token_account,
            admin_authority: payer.pubkey(),
            mint: TOKEN_MINT.parse::<Pubkey>()?,
            user_ata: voter_ata,
            token_program: TOKEN_PROGRAM.parse::<Pubkey>()?,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM.parse::<Pubkey>()?,
            system_program: system_program::ID,
        })
        .args(governance::instruction::EnsureUserCanVote { vote_fee })
        .signer(&*voter)
        .send()
        .await;

    match send_res {
        Ok(sig) => println!("Ensured can vote: {sig}"),
        Err(e) => print_transaction_logs(&e),
    }

    let send_res = program
        .request()
        .accounts(governance::accounts::Voter {
            voter_data: voter_pda,
            signer: voter.pubkey(),
            vote_manager: vote_manager_pda,
            admin_token_account,
            project: project_data_pda,
            mint: TOKEN_MINT.parse::<Pubkey>()?,
            token: voter_ata,
            token_program: TOKEN_PROGRAM.parse::<Pubkey>()?,
            system_program: system_program::ID,
        })
        .args(governance::instruction::DoVote)
        .signer(&*voter)
        .send()
        .await;

    match send_res {
        Ok(sig) => println!("Success! Vote casted. Tx signature: {sig}"),
        Err(e) => print_transaction_logs(&e),
    }

    Ok(())
}

async fn get_fee(admin_keypair: Keypair, cluster: Cluster) -> Result<(), Box<dyn Error>> {
    let payer = Rc::new(admin_keypair);
    let client = Client::new(cluster, payer.clone());
    let governance_program_pubkey = GOVERNANCE_PROGRAM_ID.parse::<Pubkey>()?;
    let program = client.program(governance_program_pubkey)?;

    let (vote_data_pda, _) = derive_vote_manager_pda(&program.payer(), &program.id());
    let vote_manager: governance::instructions::VoteManager =
        program.account(vote_data_pda).await?;

    println!("Current vote fee: {}", vote_manager.vote_fee);

    Ok(())
}

async fn get_vote_count(
    project_key: &str,
    admin_keypair: Keypair,
    cluster: Cluster,
) -> Result<(), Box<dyn Error>> {
    let payer = Rc::new(admin_keypair);
    let client = Client::new(cluster, payer.clone());
    let governance_program_pubkey = GOVERNANCE_PROGRAM_ID.parse::<Pubkey>()?;
    let program = client.program(governance_program_pubkey)?;

    // Get the current voting round from the VoteManager account.
    let (vote_data_pda, _) = derive_vote_manager_pda(&program.payer(), &program.id());
    let vote_manager: governance::instructions::VoteManager =
        program.account(vote_data_pda).await?;
    let current_round = vote_manager.vote_round; // Depending on your generated type, this may be voteRound

    // Derive the PDA for the specified project.
    let (project_pda, _) =
        derive_project_pda(project_key, current_round, &program.payer(), &program.id());

    // Fetch the ProjectData account.
    let project_data: governance::ProjectData = program.account(project_pda).await?;
    println!(
        "Project {} vote count: {}",
        project_key, project_data.vote_count
    );

    Ok(())
}

fn derive_voter_pda(
    round: u8,
    voter_pubkey: &Pubkey,
    program_id: &Pubkey,
    project_id: &str,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"voter",
            &[round, 1, 1, 1, 1],
            &voter_pubkey.to_bytes(),
            project_id.as_bytes(),
        ],
        program_id,
    )
}

fn derive_project_pda(
    project_key: &str,
    round: u8,
    admin_pubkey: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[project_key.as_bytes(), &[round], &admin_pubkey.to_bytes()],
        program_id,
    )
}

fn derive_vote_manager_pda(admin_pubkey: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vote_manager", &admin_pubkey.to_bytes()], program_id)
}

fn get_keypair(str: &str) -> Result<Keypair, Box<dyn Error>> {
    let file = String::from_utf8(tilde_expand::tilde_expand(str.as_bytes()))?;
    read_keypair_file(file)
}

fn admin_secret() -> String {
    env::var("ADMIN_SECRET").unwrap_or_else(|_| "~/.config/solana/id.json".to_string())
}

fn network() -> Result<Cluster, Box<dyn Error>> {
    env::var("NETWORK")
        .unwrap_or_else(|_| "-ul".into())
        .chars()
        .last()
        .map(|c| c.to_string())
        .ok_or("Invalid network".into())
        .and_then(|s| s.parse::<Cluster>().map_err(|e| e.into()))
}

fn print_transaction_logs(e: &anchor_client::ClientError) {
    if let SolanaClientError(solana_err) = e {
        if let RpcError(SolanaRpcError::RpcResponseError { data, .. }) = &solana_err.kind {
            match data {
                RpcResponseErrorData::Empty => {
                    println!("empty")
                }
                RpcResponseErrorData::SendTransactionPreflightFailure(data) => {
                    println!("{:#?}", data)
                }
                _ => {
                    println!("Unknown error");
                }
            }
        }
    }
}
