// import * as anchor from "@coral-xyz/anchor"
// import { Program } from "@coral-xyz/anchor"
// import { expect } from "chai"
// import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token"
// import { VoteProject } from "../target/types/vote_project"

// import {
//   Connection,
//   PublicKey,
//   LAMPORTS_PER_SOL,
//   Keypair,
//   RpcResponseAndContext,
//   SignatureResult,
// } from "@solana/web3.js";

// // Local Anchor's provider which holds Connection to the cluster and wallet
// const provider = anchor.AnchorProvider.env();
// anchor.setProvider(provider);

// // WARN: Hardcoded token mint
// const token_mint = new anchor.web3.PublicKey("QZL5xBYTFttwULqgKrXFDZep8WvweocqxbXWzJJq7J8");
// // Admin's keypair is being taken from your env (e.g. ~/.config/solana/id.json)
// const admin_wallet = provider.wallet;
// const token_program = anchor.web3.SystemProgram.programId; // Default system program as placeholder

// describe("vote-project-tests", () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);

//   const program = anchor.workspace.VoteProject;

//   it("Admin Initialization with Correct Admin Key", async () => {
//     const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//       [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//       program.programId
//     )[0];

//     await program.methods
//       .initialize(token_mint, token_program, new anchor.BN(100)) // Provide appropriate fee
//       .accounts({
//         voteData: voteManagerPda,
//         owner: admin_wallet.publicKey,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .rpc();

//     const account = await program.account.voteManager.fetch(voteManagerPda);

//     // Assert that the vote manager is initialized with the correct data
//     expect(account.voteRound).to.equal(1);
//     expect(account.admin.toBase58()).to.equal(admin_wallet.publicKey.toBase58());
//     expect(account.tkMint.toBase58()).to.equal(token_mint.toBase58());
//     expect(account.tkProgram.toBase58()).to.equal(token_program.toBase58());
//     expect(account.voteFee.toNumber()).to.equal(100);
//   });

//   // it("Admin Initialization with Incorrect Admin Key", async () => {
//   //   const unauthorizedAdmin = anchor.web3.Keypair.generate();
//   //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [Buffer.from("vote_manager"), unauthorizedAdmin.publicKey.toBuffer()],
//   //     program.programId
//   //   )[0];

//   //   // Ensure unauthorizedAdmin (attacker) has enough SOL
//   //   await airdropIfNeeded(provider.connection, unauthorizedAdmin.publicKey, 2);

//   //   try {
//   //     await program.methods
//   //       .initialize(token_mint, token_program, new anchor.BN(100))
//   //       .accounts({
//   //         voteData: voteManagerPda,
//   //         owner: unauthorizedAdmin.publicKey,
//   //         systemProgram: anchor.web3.SystemProgram.programId,
//   //       })
//   //       .signers([unauthorizedAdmin])
//   //       .rpc();

//   //     throw new Error("Expected transaction to fail, but it succeeded");
//   //   } catch (err) {
//   //        expect(err.error.errorCode.code).to.equal("NotAdmin");
//   //   }
//   // });

//   // it("Duplicate Initialization", async () => {
//   //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//   //     program.programId
//   //   )[0];
//   //   try {
//   //     await program.methods
//   //       .initialize(token_mint, token_program, new anchor.BN(100))
//   //       .accounts({
//   //         voteData: voteManagerPda,
//   //         owner: admin_wallet.publicKey,
//   //         systemProgram: anchor.web3.SystemProgram.programId,
//   //       })
//   //       .rpc();
//   //   } catch (err) {
//   //     expect(err.error.errorCode.code).to.equal("DoubleInitAttempt");
//   //   }
//   // });

//   // it("Increment Round by Admin", async () => {
//   //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//   //     program.programId
//   //   )[0];

//   //   // Fetch the initial account data
//   //   let account = await program.account.voteManager.fetch(voteManagerPda);
//   //   const initialRound = account.voteRound;

//   //   // Call the increment_round method
//   //   await program.methods
//   //     .incrementRound()
//   //     .accounts({
//   //       voteData: voteManagerPda,
//   //       owner: admin_wallet.publicKey,
//   //     })
//   //     .rpc();

//   //   // Fetch the updated account data
//   //   account = await program.account.voteManager.fetch(voteManagerPda);

//   //   // Assert that the vote round incremented by 1
//   //   expect(account.voteRound).to.equal(initialRound + 1);
//   // });

//   // it("Increment Round by Non-Admin", async () => {
//   //   const unauthorizedUser = anchor.web3.Keypair.generate();
//   //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//   //     program.programId
//   //   )[0];

//   //   // Ensure unauthorizedUser (attacker) has enough SOL
//   //   await airdropIfNeeded(provider.connection, unauthorizedUser.publicKey, 2);

//   //   try {
//   //     // Attempt to increment the round
//   //     await program.methods
//   //       .incrementRound()
//   //       .accounts({
//   //         voteData: voteManagerPda,
//   //         owner: unauthorizedUser.publicKey,
//   //       })
//   //       .signers([unauthorizedUser])
//   //       .rpc();

//   //     throw new Error("Expected transaction to fail, but it succeeded");
//   //   } catch (err) {
//   //     expect(err.error.errorCode.code).to.equal("ConstraintSeeds");
//   //   }
//   // });

//   // it("Admin Changes Fee", async () => {
//   //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//   //     program.programId
//   //   )[0];

//   //   // Fetch the current account data
//   //   let account = await program.account.voteManager.fetch(voteManagerPda);
//   //   const initialFee = account.voteFee;

//   //   // Set a new fee value
//   //   const newFee = new anchor.BN(500); // Update to 500 (e.g., 500 tokens as fee)

//   //   // Call the change_fee method
//   //   await program.methods
//   //     .changeFee(newFee)
//   //     .accounts({
//   //       voteData: voteManagerPda,
//   //       owner: admin_wallet.publicKey,
//   //     })
//   //     .rpc();

//   //   // Fetch the updated account data
//   //   account = await program.account.voteManager.fetch(voteManagerPda);

//   //   // Assert that the fee was successfully updated
//   //   expect(account.voteFee.toNumber()).to.equal(newFee.toNumber());
//   //   expect(account.voteFee.toNumber()).to.not.equal(initialFee.toNumber());
//   // });

//   // it("Non-Admin Tries to Change Fee", async () => {
//   //   const unauthorizedUser = anchor.web3.Keypair.generate();
//   //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//   //     program.programId
//   //   )[0];

//   //   // Ensure unauthorizedUser (attacker) has enough SOL
//   //   await airdropIfNeeded(provider.connection, unauthorizedUser.publicKey, 2);

//   //   // Set a new fee value
//   //   const newFee = new anchor.BN(500);

//   //   try {
//   //     // Attempt to call the change_fee method
//   //     await program.methods
//   //       .changeFee(newFee)
//   //       .accounts({
//   //         voteData: voteManagerPda,
//   //         owner: unauthorizedUser.publicKey,
//   //       })
//   //       .signers([unauthorizedUser]) // Sign the transaction as unauthorizedUser
//   //       .rpc();

//   //     throw new Error("Expected transaction to fail, but it succeeded");
//   //   } catch (err) {
//   //     expect(err.error.errorCode.code).to.equal("ConstraintSeeds");
//   //   }
//   // });

//   // it("Add Project with Unique idx", async () => {
//   //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//   //     program.programId
//   //   )[0];

//   //   const projectIdx = "project1"; // Unique project identifier
//   //   const projectPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [
//   //       Buffer.from(projectIdx),
//   //       new anchor.BN(1).toArrayLike(Buffer, "le", 1), // Current round
//   //       admin_wallet.publicKey.toBuffer(),
//   //     ],
//   //     program.programId
//   //   )[0];

//   //   // Add a project
//   //   await program.methods
//   //     .addProject(projectIdx)
//   //     .accounts({
//   //       projectData: projectPda,
//   //       voteManager: voteManagerPda,
//   //       owner: admin_wallet.publicKey,
//   //       systemProgram: anchor.web3.SystemProgram.programId,
//   //     })
//   //     .rpc();

//   //   const projectAccount = await program.account.projectData.fetch(projectPda);

//   //   // Assert that the project is initialized with correct data
//   //   expect(projectAccount.idx).to.equal(projectIdx);
//   //   expect(projectAccount.voteCount.toNumber()).to.equal(0);
//   //   expect(projectAccount.voteRound).to.equal(1); // Round should match the current round
//   //   expect(projectAccount.voteFee.toNumber()).to.equal(100); // Ensure vote fee matches the vote manager's fee
//   // });

//   // it("Add Project with Duplicate idx", async () => {
//   //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//   //     program.programId
//   //   )[0];

//   //   const projectIdx = "project2"; // Duplicate project identifier
//   //   const projectPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [
//   //       Buffer.from(projectIdx),
//   //       new anchor.BN(1).toArrayLike(Buffer, "le", 1), // Current round
//   //       admin_wallet.publicKey.toBuffer(),
//   //     ],
//   //     program.programId
//   //   )[0];

//   //   // Add a project (initial attempt)
//   //   await program.methods
//   //     .addProject(projectIdx)
//   //     .accounts({
//   //       projectData: projectPda,
//   //       voteManager: voteManagerPda,
//   //       owner: admin_wallet.publicKey,
//   //       systemProgram: anchor.web3.SystemProgram.programId,
//   //     })
//   //     .rpc();

//   //   try {
//   //     // Attempt to add the same project again
//   //     await program.methods
//   //       .addProject(projectIdx)
//   //       .accounts({
//   //         projectData: projectPda,
//   //         voteManager: voteManagerPda,
//   //         owner: admin_wallet.publicKey,
//   //         systemProgram: anchor.web3.SystemProgram.programId,
//   //       })
//   //       .rpc();

//   //     throw new Error("Expected transaction to fail, but it succeeded");
//   //   } catch (err) {
//   //     expect(err.message).to.include("already in use");
//   //   }
//   // });

//   // it("Reuse idx in a New Round", async () => {
//   //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//   //     program.programId
//   //   )[0];

//   //   const projectIdx = "project3"; // Project identifier
//   //   const projectPdaRound1 = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [
//   //       Buffer.from(projectIdx),
//   //       new anchor.BN(1).toArrayLike(Buffer, "le", 1), // Round 1
//   //       admin_wallet.publicKey.toBuffer(),
//   //     ],
//   //     program.programId
//   //   )[0];

//   //   const projectPdaRound2 = anchor.web3.PublicKey.findProgramAddressSync(
//   //     [
//   //       Buffer.from(projectIdx),
//   //       new anchor.BN(2).toArrayLike(Buffer, "le", 1), // Round 2
//   //       admin_wallet.publicKey.toBuffer(),
//   //     ],
//   //     program.programId
//   //   )[0];

//   //   // Add a project in round 1
//   //   await program.methods
//   //     .addProject(projectIdx)
//   //     .accounts({
//   //       projectData: projectPdaRound1,
//   //       voteManager: voteManagerPda,
//   //       owner: admin_wallet.publicKey,
//   //       systemProgram: anchor.web3.SystemProgram.programId,
//   //     })
//   //     .rpc();

//   //   // Increment the round
//   //   await program.methods
//   //     .incrementRound()
//   //     .accounts({
//   //       voteData: voteManagerPda,
//   //       owner: admin_wallet.publicKey,
//   //     })
//   //     .rpc();

//   //   // Add the same project in round 2
//   //   await program.methods
//   //     .addProject(projectIdx)
//   //     .accounts({
//   //       projectData: projectPdaRound2,
//   //       voteManager: voteManagerPda,
//   //       owner: admin_wallet.publicKey,
//   //       systemProgram: anchor.web3.SystemProgram.programId,
//   //     })
//   //     .rpc();

//   //   const projectAccountRound1 = await program.account.projectData.fetch(projectPdaRound1);
//   //   const projectAccountRound2 = await program.account.projectData.fetch(projectPdaRound2);

//   //   // Assert that both projects exist and are tied to their respective rounds
//   //   expect(projectAccountRound1.idx).to.equal(projectIdx);
//   //   expect(projectAccountRound1.voteRound).to.equal(1);

//   //   expect(projectAccountRound2.idx).to.equal(projectIdx);
//   //   expect(projectAccountRound2.voteRound).to.equal(2);
//   // });
//   it("Successful Vote", async () => {
//     const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
//       [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
//       program.programId
//     )[0];

//     const projectIdx = "project4";
//     const projectPda = anchor.web3.PublicKey.findProgramAddressSync(
//       [
//         Buffer.from(projectIdx),
//         new anchor.BN(1).toArrayLike(Buffer, "le", 1), // Round 1
//         admin_wallet.publicKey.toBuffer(),
//       ],
//       program.programId
//     )[0];

//     const voter = anchor.web3.Keypair.generate();
//     const voterPda = anchor.web3.PublicKey.findProgramAddressSync(
//       [
//         Buffer.from("vouter"),
//         new anchor.BN(1).toArrayLike(Buffer, "le", 1), // Round 1
//         voter.publicKey.toBuffer(),
//       ],
//       program.programId
//     )[0];

//     // Airdrop SOL to the voter
//     await airdropIfNeeded(provider.connection, voter.publicKey, 2);

//     // Add the project
//     await program.methods
//       .addProject(projectIdx)
//       .accounts({
//         projectData: projectPda,
//         voteManager: voteManagerPda,
//         owner: admin_wallet.publicKey,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .rpc();

//     // Perform the vote
//     await program.methods
//       .doVote(1) // Current round
//       .accounts({
//         vouterData: voterPda,
//         signer: voter.publicKey,
//         voteManager: voteManagerPda,
//         adminForFee: admin_wallet.publicKey,
//         project: projectPda,
//         mint: token_mint,
//         token: await getAssociatedTokenAddress(token_mint, voter.publicKey),
//         tokenProgram: token_program,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .signers([voter])
//       .rpc();

//     const projectAccount = await program.account.projectData.fetch(projectPda);
//     const voterAccount = await program.account.vouterData.fetch(voterPda);

//     // Assert project and voter data updates
//     expect(projectAccount.voteCount.toNumber()).to.be.greaterThan(0);
//     expect(voterAccount.voteCount.toNumber()).to.be.greaterThan(0);
//     expect(voterAccount.lastVotedRound).to.equal(1);
//   });
// });


// /**
//  * Ensures an account has a minimum balance of SOL. Airdrops if the balance is insufficient.
//  * 
//  * @param connection - The Solana connection object.
//  * @param publicKey - The public key of the account to check.
//  * @param minBalanceInSol - The minimum balance (in SOL) required for the account. Defaults to 1 SOL.
//  */
// async function airdropIfNeeded(
//   connection: Connection,
//   publicKey: PublicKey,
//   minBalanceInSol: number = 1
// ): Promise<void> {
//   // Fetch the current balance in lamports
//   const currentBalance = await connection.getBalance(publicKey);

//   // Convert the balance to SOL for easier comparison
//   const currentBalanceInSol = currentBalance / LAMPORTS_PER_SOL;

//   if (currentBalanceInSol < minBalanceInSol) {
//     const requiredAirdrop = minBalanceInSol - currentBalanceInSol;
//     const signature = await connection.requestAirdrop(
//       publicKey,
//       requiredAirdrop * LAMPORTS_PER_SOL
//     );

//     // New confirmation strategy based on block height
//     const latestBlockhash = await connection.getLatestBlockhash();
//     const confirmationResult: RpcResponseAndContext<SignatureResult> =
//       await connection.confirmTransaction(
//         {
//           signature,
//           blockhash: latestBlockhash.blockhash,
//           lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
//         },
//         "finalized"
//       );

//     if (confirmationResult.value.err) {
//       throw new Error(
//         `Airdrop transaction failed: ${JSON.stringify(confirmationResult.value.err)}`
//       );
//     }

//     // console.log(
//     //   `Airdropped ${requiredAirdrop.toFixed(2)} SOL to ${publicKey.toBase58()}. New balance is sufficient.`
//     // );
//   } else {
//     console.log(
//       `Account ${publicKey.toBase58()} already has ${currentBalanceInSol.toFixed(
//         2
//       )} SOL, no airdrop needed.`
//     );
//   }
// }
