import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { VoteProject } from "../target/types/vote_project"
import { createAssociatedTokenAccount, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
  RpcResponseAndContext,
  SignatureResult,
} from "@solana/web3.js";
import { TokenExtensions } from "../target/types/token_extensions"
import { associatedAddress } from "./token"
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token"

// Local Anchor's provider which holds Connection to the cluster and wallet
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const token_mint = Keypair.generate(); // Generate a new token mint
const voter = Keypair.generate(); // Generate a voter account
// Compute associated token account address
const voterMintTokenAccount = getAssociatedTokenAddressSync(
  token_mint.publicKey, // Mint address
  voter.publicKey, // Token account owner
  true, // Indicates this is for Token 2022
  TOKEN_2022_PROGRAM_ID, // Token program
  ASSOCIATED_PROGRAM_ID // Associated Token Program for Token 2022
);

// WARN: Hardcoded token mint
// Admin's keypair is being taken from your env (e.g. ~/.config/solana/id.json)
const admin_wallet = provider.wallet;
describe("vote-project-tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VoteProject;

  const tokenProgram = anchor.workspace.TokenExtensions as Program<TokenExtensions>;

  it("Admin Initialization with Correct Admin Key", async () => {
    const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
      program.programId
    )[0];

    // Airdrop SOL to voter
    await airdropIfNeeded(provider.connection, voter.publicKey, 1);

    // Create token mint and mint some tokens to voter
    const [extraMetasAccount] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("extra-account-metas"),
        token_mint.publicKey.toBuffer(),
      ],
      tokenProgram.programId
    );

    let accountsStrict = {
      payer: provider.publicKey,
      authority: provider.publicKey,
      receiver: provider.publicKey,
      mint: token_mint.publicKey,
      mintTokenAccount: associatedAddress({
        mint: token_mint.publicKey,
        owner: provider.publicKey,
      }),
      extraMetasAccount: extraMetasAccount,
      systemProgram: anchor.web3.SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    };

    await tokenProgram.methods
      .createMintAccount({
        name: "Quantzilla Labs Token",
        symbol: "QZL",
        uri: "https://my-token-data.com/metadata.json",
      })
      .accountsStrict(accountsStrict)
      .signers([token_mint])
      .rpc();

    await program.methods
      .initialize(token_mint.publicKey, TOKEN_2022_PROGRAM_ID, new anchor.BN(100))
      .accounts({
        voteData: voteManagerPda,
        owner: admin_wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.voteManager.fetch(voteManagerPda);

    // Assert that the vote manager is initialized with the correct data
    expect(account.voteRound).to.equal(1);
    expect(account.admin.toBase58()).to.equal(admin_wallet.publicKey.toBase58());
    expect(account.tkMint.toBase58()).to.equal(token_mint.publicKey.toBase58());
    expect(account.tkProgram.toBase58()).to.equal(TOKEN_2022_PROGRAM_ID.toBase58());
    expect(account.voteFee.toNumber()).to.equal(100);
  });

  it("Admin Initialization with Incorrect Admin Key", async () => {
    const unauthorizedAdmin = anchor.web3.Keypair.generate();
    const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote_manager"), unauthorizedAdmin.publicKey.toBuffer()],
      program.programId
    )[0];

    await airdropIfNeeded(provider.connection, unauthorizedAdmin.publicKey, 1);

    try {
      await program.methods
        .initialize(token_mint.publicKey, TOKEN_2022_PROGRAM_ID, new anchor.BN(100))
        .accounts({
          voteData: voteManagerPda,
          owner: unauthorizedAdmin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([unauthorizedAdmin])
        .rpc();

      throw new Error("Expected transaction to fail, but it succeeded");
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("NotAdmin");
    }
  });

  it("Duplicate Initialization", async () => {
    const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
      program.programId
    )[0];
    try {
      await program.methods
        .initialize(token_mint.publicKey, TOKEN_2022_PROGRAM_ID, new anchor.BN(100))
        .accounts({
          voteData: voteManagerPda,
          owner: admin_wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("DoubleInitAttempt");
    }
  });

  it("Admin Changes Fee", async () => {
    const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
      program.programId
    )[0];

    // Fetch the current account data
    let account = await program.account.voteManager.fetch(voteManagerPda);
    const initialFee = account.voteFee;

    // Set a new fee value
    const newFee = new anchor.BN(500); // Update to 500 (e.g., 500 tokens as fee)

    // Call the change_fee method
    await program.methods
      .changeFee(newFee)
      .accounts({
        voteData: voteManagerPda,
        owner: admin_wallet.publicKey,
      })
      .rpc();

    // Fetch the updated account data
    account = await program.account.voteManager.fetch(voteManagerPda);

    // Assert that the fee was successfully updated
    expect(account.voteFee.toNumber()).to.equal(newFee.toNumber());
    expect(account.voteFee.toNumber()).to.not.equal(initialFee.toNumber());
  });

  it("Non-Admin Tries to Change Fee", async () => {
    const unauthorizedUser = anchor.web3.Keypair.generate();
    const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
      program.programId
    )[0];

    // Ensure unauthorizedUser (attacker) has enough SOL
    await airdropIfNeeded(provider.connection, unauthorizedUser.publicKey, 2);

    // Set a new fee value
    const newFee = new anchor.BN(500);

    try {
      // Attempt to call the change_fee method
      await program.methods
        .changeFee(newFee)
        .accounts({
          voteData: voteManagerPda,
          owner: unauthorizedUser.publicKey,
        })
        .signers([unauthorizedUser]) // Sign the transaction as unauthorizedUser
        .rpc();

      throw new Error("Expected transaction to fail, but it succeeded");
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("ConstraintSeeds");
    }
  });

  it("Add Project with Unique idx", async () => {
    const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
      program.programId
    )[0];

    const projectIdx = "project1"; // Unique project identifier
    const projectPda = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(projectIdx),
        new anchor.BN(1).toArrayLike(Buffer, "le", 1), // Current round
        admin_wallet.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    // Add a project
    await program.methods
      .addProject(projectIdx)
      .accounts({
        projectData: projectPda,
        voteManager: voteManagerPda,
        owner: admin_wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const projectAccount = await program.account.projectData.fetch(projectPda);

    // Assert that the project is initialized with correct data
    expect(projectAccount.idx).to.equal(projectIdx);
    expect(projectAccount.voteCount.toNumber()).to.equal(0);
    expect(projectAccount.voteRound).to.equal(1); // Round should match the current round
    expect(projectAccount.voteFee.toNumber()).to.equal(500); // Ensure vote fee matches the vote manager's fee
  });

  it("Add Project with Duplicate idx", async () => {
    const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
      program.programId
    )[0];

    const projectIdx = "project2"; // Duplicate project identifier
    const projectPda = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(projectIdx),
        new anchor.BN(1).toArrayLike(Buffer, "le", 1), // Current round
        admin_wallet.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    // Add a project (initial attempt)
    await program.methods
      .addProject(projectIdx)
      .accounts({
        projectData: projectPda,
        voteManager: voteManagerPda,
        owner: admin_wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    try {
      // Attempt to add the same project again
      await program.methods
        .addProject(projectIdx)
        .accounts({
          projectData: projectPda,
          voteManager: voteManagerPda,
          owner: admin_wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      throw new Error("Expected transaction to fail, but it succeeded");
    } catch (err) {
      expect(err.message).to.include("already in use");
    }
  });

  it("Reuse idx in a New Round", async () => {
    const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
      program.programId
    )[0];

    const projectIdx = "project3"; // Project identifier
    const projectPdaRound1 = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(projectIdx),
        new anchor.BN(1).toArrayLike(Buffer, "le", 1), // Round 1
        admin_wallet.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    const projectPdaRound2 = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(projectIdx),
        new anchor.BN(2).toArrayLike(Buffer, "le", 1), // Round 2
        admin_wallet.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    // Add a project in round 1
    await program.methods
      .addProject(projectIdx)
      .accounts({
        projectData: projectPdaRound1,
        voteManager: voteManagerPda,
        owner: admin_wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Increment the round
    await program.methods
      .incrementRound()
      .accounts({
        voteData: voteManagerPda,
        owner: admin_wallet.publicKey,
      })
      .rpc();

    // Add the same project in round 2
    await program.methods
      .addProject(projectIdx)
      .accounts({
        projectData: projectPdaRound2,
        voteManager: voteManagerPda,
        owner: admin_wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const projectAccountRound1 = await program.account.projectData.fetch(projectPdaRound1);
    const projectAccountRound2 = await program.account.projectData.fetch(projectPdaRound2);

    // Assert that both projects exist and are tied to their respective rounds
    expect(projectAccountRound1.idx).to.equal(projectIdx);
    expect(projectAccountRound1.voteRound).to.equal(1);
    expect(projectAccountRound2.idx).to.equal(projectIdx);
    expect(projectAccountRound2.voteRound).to.equal(2);
  });

  it("Successful vote", async () => {
    const voteProgram = anchor.workspace.VoteProject as Program<VoteProject>;

    const projectIdx = "projectVote1";

    // Derive PDAs
    const voteManagerPda = PublicKey.findProgramAddressSync(
      [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
      voteProgram.programId
    )[0];

    const projectPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from(projectIdx),
        new anchor.BN(1).toArrayLike(Buffer, "le", 1),
        admin_wallet.publicKey.toBuffer(),
      ],
      voteProgram.programId
    )[0];

    const voterDataPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vouter"),
        Buffer.from([1, 1, 1, 1, 1, 1]), // Round (1) + padding
        voter.publicKey.toBuffer(),
      ],
      voteProgram.programId
    )[0];

    // Ensure Admin and Voter Token Accounts Exist
    const adminAta = await getAssociatedTokenAddress(
      token_mint.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    const voterAta = await getAssociatedTokenAddress(
      token_mint.publicKey,
      voter.publicKey,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    // Step 1: Ensure ATAs are Initialized
    const ataTransaction = new anchor.web3.Transaction();
    if (!(await provider.connection.getAccountInfo(voterAta))) {
      ataTransaction.add(
        createAssociatedTokenAccountInstruction(
          voter.publicKey,        // Payer: provider
          voterAta,
          voter.publicKey,           // Owner of ATA
          token_mint.publicKey,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_PROGRAM_ID
        )
      );
    }

    if (!(await provider.connection.getAccountInfo(adminAta))) {
      ataTransaction.add(
        createAssociatedTokenAccountInstruction(
          provider.publicKey,        // Payer: provider
          adminAta,
          TOKEN_2022_PROGRAM_ID,    // Admin ATA owner
          token_mint.publicKey,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_PROGRAM_ID
        )
      );
    }
    await provider.sendAndConfirm(ataTransaction); // No need for extra signers here

    console.log(adminAta);
    console.log(voterAta);

  //   // Step 2: Mint Tokens to Voter's ATA
  //   await tokenProgram.methods
  //     .mintToAccount(new anchor.BN(100)) // Mint 100 tokens
  //     .accounts({
  //       mint: token_mint.publicKey,
  //       tokenAccount: voterAta,
  //       authority: provider.publicKey,
  //       tokenProgram: TOKEN_2022_PROGRAM_ID,
  //     })
  //     .rpc();

  //   let add_project_accounts = {
  //     projectData: projectPda,
  //     voteManager: voteManagerPda,
  //     owner: admin_wallet.publicKey,
  //     systemProgram: anchor.web3.SystemProgram.programId,
  //   }

  //   // Step 3: Add Project
  //   await voteProgram.methods
  //     .addProject(projectIdx)
  //     .accounts(add_project_accounts)
  //     .rpc();

  //   let do_vote_accounts = {
  //     vouterData: voterDataPda,
  //     signer: voter.publicKey,
  //     voteManager: voteManagerPda,
  //     adminForFee: adminAta,
  //     project: projectPda,
  //     mint: token_mint.publicKey,
  //     token: voterAta,
  //     tokenProgram: TOKEN_2022_PROGRAM_ID,
  //     systemProgram: anchor.web3.SystemProgram.programId,
  //   }

  //   // Step 4: Perform the Vote
  //   await voteProgram.methods
  //     .doVote(1) // Round 1
  //     .accounts(do_vote_accounts)
  //     .signers([voter]) // Ensure voter is signing here
  //     .rpc();

  //   // Step 5: Verify Results
  //   const projectAccount = await voteProgram.account.projectData.fetch(projectPda);
  //   const voterAccount = await voteProgram.account.vouterData.fetch(voterDataPda);

  //   expect(projectAccount.voteCount.toNumber()).to.be.greaterThan(0);
  //   expect(voterAccount.voteCount.toNumber()).to.be.greaterThan(0);
  //   expect(voterAccount.lastVotedRound).to.equal(1);
  });

  // it("Increment Round by Admin", async () => {
  //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
  //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
  //     program.programId
  //   )[0];

  //   // Fetch the initial account data
  //   let account = await program.account.voteManager.fetch(voteManagerPda);
  //   const initialRound = account.voteRound;

  //   // Call the increment_round method
  //   await program.methods
  //     .incrementRound()
  //     .accounts({
  //       voteData: voteManagerPda,
  //       owner: admin_wallet.publicKey,
  //     })
  //     .rpc();

  //   // Fetch the updated account data
  //   account = await program.account.voteManager.fetch(voteManagerPda);

  //   // Assert that the vote round incremented by 1
  //   expect(account.voteRound).to.equal(initialRound + 1);
  // });

  // it("Increment Round by Non-Admin", async () => {
  //   const unauthorizedUser = anchor.web3.Keypair.generate();
  //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
  //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
  //     program.programId
  //   )[0];

  //   // Ensure unauthorizedUser (attacker) has enough SOL
  //   await airdropIfNeeded(provider.connection, unauthorizedUser.publicKey, 2);

  //   try {
  //     // Attempt to increment the round
  //     await program.methods
  //       .incrementRound()
  //       .accounts({
  //         voteData: voteManagerPda,
  //         owner: unauthorizedUser.publicKey,
  //       })
  //       .signers([unauthorizedUser])
  //       .rpc();

  //     throw new Error("Expected transaction to fail, but it succeeded");
  //   } catch (err) {
  //     expect(err.error.errorCode.code).to.equal("ConstraintSeeds");
  //   }
  // });

  // it("Voting Fee Transfer", async () => {
  //   const initialVoterBalance = await provider.connection.getTokenAccountBalance(voterMintTokenAccount);
  //   const adminTokenAccount = getAssociatedTokenAddressSync(token_mint, admin_wallet.publicKey);
  //   const voteManagerPda = anchor.web3.PublicKey.findProgramAddressSync(
  //     [Buffer.from("vote_manager"), admin_wallet.publicKey.toBuffer()],
  //     program.programId
  //   )[0];
  //   const projectIdx = "projectVote1";
  //   const voteProgram = anchor.workspace.VoteProject as Program<VoteProject>;

  //   // Derive the new project PDA for Round 2
  //   const projectPdaRound2 = PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from(projectIdx),
  //       new anchor.BN(2).toArrayLike(Buffer, "le", 1), // Round 2 PDA
  //       admin_wallet.publicKey.toBuffer(),
  //     ],
  //     voteProgram.programId
  //   )[0];

  //   // Initialize the project for Round 2
  //   await program.methods
  //     .addProject(projectIdx)
  //     .accounts({
  //       projectData: projectPdaRound2,
  //       voteManager: voteManagerPda,
  //       owner: admin_wallet.publicKey,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .rpc();

  //   const voterDataPda = PublicKey.findProgramAddressSync(

  //     [
  //       Buffer.from("vouter"), // Static seed matching the Rust code
  //       Buffer.from([2, 1, 1, 1, 1, 1]), // Round (1) + padding
  //       voter.publicKey.toBuffer(), // Voter's public key
  //     ],
  //     voteProgram.programId
  //   )[0];

  //   await program.methods
  //     .doVote(2) // Round was incremented in previous test - data persists in blockchain
  //     .accounts({
  //       vouterData: voterDataPda,
  //       signer: voter.publicKey,
  //       voteManager: voteManagerPda,
  //       adminForFee: admin_wallet.publicKey,
  //       project: projectPdaRound2,
  //       mint: token_mint,
  //       token: voterMintTokenAccount,
  //       tokenProgram: token_program,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .signers([voter])
  //     .rpc();

  //   const finalVoterBalance = await provider.connection.getTokenAccountBalance(voterMintTokenAccount);
  //   const adminBalance = await provider.connection.getTokenAccountBalance(adminTokenAccount);

  //   expect(finalVoterBalance.value.uiAmount).to.be.lessThan(initialVoterBalance.value.uiAmount);
  //   expect(adminBalance.value.uiAmount).to.be.greaterThan(0);
  // });
});


/**
 * Ensures an account has a minimum balance of SOL. Airdrops if the balance is insufficient.
 * 
 * @param connection - The Solana connection object.
 * @param publicKey - The public key of the account to check.
 * @param minBalanceInSol - The minimum balance (in SOL) required for the account. Defaults to 1 SOL.
 */
async function airdropIfNeeded(
  connection: Connection,
  publicKey: PublicKey,
  minBalanceInSol: number = 1
): Promise<void> {
  // Fetch the current balance in lamports
  const currentBalance = await connection.getBalance(publicKey);

  // Convert the balance to SOL for easier comparison
  const currentBalanceInSol = currentBalance / LAMPORTS_PER_SOL;

  if (currentBalanceInSol < minBalanceInSol) {
    const requiredAirdrop = minBalanceInSol - currentBalanceInSol;
    const signature = await connection.requestAirdrop(
      publicKey,
      requiredAirdrop * LAMPORTS_PER_SOL
    );

    // New confirmation strategy based on block height
    const latestBlockhash = await connection.getLatestBlockhash();
    const confirmationResult: RpcResponseAndContext<SignatureResult> =
      await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "finalized"
      );

    if (confirmationResult.value.err) {
      throw new Error(
        `Airdrop transaction failed: ${JSON.stringify(confirmationResult.value.err)}`
      );
    }

    // console.log(
    //   `Airdropped ${requiredAirdrop.toFixed(2)} SOL to ${publicKey.toBase58()}. New balance is sufficient.`
    // );
  } else {
    console.log(
      `Account ${publicKey.toBase58()} already has ${currentBalanceInSol.toFixed(
        2
      )} SOL, no airdrop needed.`
    );
  }
}
