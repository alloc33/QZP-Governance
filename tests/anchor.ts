import BN from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import type { VoteProject } from "../target/types/vote_project";

describe("Test", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  // const program = anchor.workspace.VoteProject as anchor.Program<VoteProject>;
  const program = anchor.workspace.VoteProject as anchor.Program<VoteProject>;
  
  it("initialize", async () => {
    // Generate keypair for the new account
    const voteManager = anchor.Program.fetchIdl('FPBb79RbBdnJRLgji8vhFHeBQ4gKcjjDTw7xTrYjro6p');
    program.account.projectData
    // Send transaction
    const data = new BN(42);
    const txHash = await program.methods
      .initialize(data)
      .accounts({
        newAccount: newAccountKp.publicKey,
        signer: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([newAccountKp])
      .rpc();
    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm transaction
    await program.provider.connection.confirmTransaction(txHash);

    // Fetch the created account
    const newAccount = await program.account.newAccount.fetch(
      newAccountKp.publicKey
    );

    console.log("On-chain data is:", newAccount.data.toString());

    // Check whether the data on-chain is equal to local 'data'
    assert(data.eq(newAccount.data));
  });
});
