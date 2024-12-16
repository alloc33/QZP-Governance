import * as anchor from "@coral-xyz/anchor";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { VoteProject } from "../target/types/vote_project";
import fs from 'fs'
import { Resolver } from "dns/promises";

const SECRET_KEY_BYTES = require('../../wallet-keypair.json');
// Configure the client to use the local cluster.
//anchor.setProvider(anchor.AnchorProvider.env());
const solanaConnection = new web3.Connection('http://127.0.0.1:8899/');
//const bytes = JSON.parse(fs.readFileSync("../JorqgPgAg7GH5T1bwVR7Ek6pxbJ2dU3rPRLsbAd3cHf.json"))
const admin_wallet = web3.Keypair.fromSecretKey(new Uint8Array(SECRET_KEY_BYTES));
console.log(admin_wallet.publicKey.toBase58())
const vouter_wallet = admin_wallet.publicKey;
const program = anchor.workspace.VoteProject as Program<VoteProject>;
// const fetch_json_vote_manager = program.account.voteManager.all;
// const fetch_json_project = program.account.projectData.all;
// const vote_manager_account = new web3.PublicKey("DY6jBZVTjJvhGfX78aKGqMHfcB5SRpu2r46tMevbiN9");
// const project_account = new web3.PublicKey("4DDekW8njEsb58td6oW6LqL5WYnxdq3aiyhkBGPJkYp7");
// const vouter_token_account = new web3.PublicKey("5ubstUxaANSsddJvMNe5xKBhNJeocEnco52V3XoJp7Hd");
// const token_mint = new web3.PublicKey("QZL5xBYTFttwULqgKrXFDZep8WvweocqxbXWzJJq7J8");
// const token_program = new web3.PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
// const admin_for_fee = admin_wallet.publicKey;//new web3.PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
// const round = 1;


// const PDA = web3.PublicKey.findProgramAddressSync(
//   [Buffer.from("vouter"), new Uint8Array([round, 1, 1, 1, 1, 1]), admin_wallet.publicKey.toBuffer()],
//   program.programId,
// );

// let init_Voter_accounts = {
//   PDA,
//   signer: vouter_wallet,
//   vote_manager: vote_manager_account,
//   admin_for_fee: admin_for_fee,
//   project: project_account,
//   mint: token_mint,
//   token: vouter_token_account,
//   token_program: token_program,
//   systemProgram: anchor.web3.SystemProgram.programId,
// };

// async () => {
//   // Add your test here.
//   const tx = await program
//     .methods
//     .do_vote(round)
//     .accounts(init_Voter_accounts)
//     .rpc();
//   console.log("Your transaction signature", tx);
// }
