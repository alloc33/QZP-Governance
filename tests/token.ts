import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TokenExtensions } from "../target/types/token_extensions";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { assert, expect } from "chai";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export function associatedAddress({
  mint,
  owner,
}: {
  mint: PublicKey;
  owner: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_PROGRAM_ID
  )[0];
}

// describe("token extensions", () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);

//   const program = anchor.workspace.TokenExtensions as Program<TokenExtensions>;

//   let mint = new Keypair();

//   it("Create mint account test passes", async () => {
//     const [extraMetasAccount] = PublicKey.findProgramAddressSync(
//       [
//         anchor.utils.bytes.utf8.encode("extra-account-metas"),
//         mint.publicKey.toBuffer(),
//       ],
//       program.programId
//     );

//     await program.methods
//       .createMintAccount({
//         name: "quick token",
//         symbol: "QT",
//         uri: "https://my-token-data.com/metadata.json",
//       })
//       .accountsStrict({
//         payer: provider.publicKey,
//         authority: provider.publicKey,
//         receiver: provider.publicKey,
//         mint: mint.publicKey,
//         mintTokenAccount: associatedAddress({
//           mint: mint.publicKey,
//           owner: provider.publicKey,
//         }),
//         extraMetasAccount: extraMetasAccount,
//         systemProgram: anchor.web3.SystemProgram.programId,
//         associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
//         tokenProgram: TOKEN_2022_PROGRAM_ID,
//       })
//       .signers([mint])
//       .rpc();
//   });

//   it("mint extension constraints test passes", async () => {
//     try {
//       const tx = await program.methods
//         .checkMintExtensionsConstraints()
//         .accountsStrict({
//           authority: provider.publicKey,
//           mint: mint.publicKey,
//         })
//         .rpc();
//       assert.ok(tx, "transaction should be processed without error");
//     } catch (e) {
//       assert.fail('should not throw error');
//     }
//   });

//   it("Mint extension constraints fails with invalid authority", async () => {
//     const wrongAuth = Keypair.generate();
//     try {
//       await program.methods
//         .checkMintExtensionsConstraints()
//         .accountsStrict({
//           authority: wrongAuth.publicKey,
//           mint: mint.publicKey,
//         })
//         .signers([wrongAuth])
//         .rpc();

//       assert.fail('should have thrown an error');
//     } catch (e) {
//       expect(e, 'should throw error');
//     }

//   })
// });
