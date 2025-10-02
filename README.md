# QZP Token Project

Available commands:
```shell
$ just create-token                      # Create QZL token (mint, metadata, supply, revoke authority). Defaults to localnet\n.

$ just init-force                        # Initialize the VoteManager forcefully
$ just increment-round                   # Increment the current voting round
$ just change-fee <new_fee>              # Change the voting fee
$ just add-project <project_key>         # Add a new project to a voting round
$ just do-vote <project_key>             # Cast a vote for a project in a specific round
$ just get-round                         # Get the current voting round
$ just help                              # Utility to print available commands
```
Be sure you have admin's dev wallet (pubkey: E88MCgENj4uksz3QX9DUYRKqM8sJfqHGxCueWDnTPDep)

This project consists of two Solana programs:

## Governance Program
- Manages voting logic and processes.
- Key responsibilities:
  - Voting round initialization and increments.
  - Project registration for voting.
  - QZP token-based voting system.

## QZP Token Program
- Implements the **QZP token** using Solana's Token-2022 standard.
- Key responsibilities:
  - Creates the QZP token mint with an initial supply of **450 million tokens**.
  - Automatically mints the entire supply to the admin's associated token account during token creation.

## Key Features
- **Governance**:
  - Admin-controlled voting manager.
  - Projects and voting tied to specific rounds.
  - Transparent, token-based voting system.
  
- **Token**:
  - Token-2022 compatibility with enhanced extensions.
  - Automatic metadata and authority management.
  - Fixed total supply, ensuring no further minting.

### The qzp_mint.sh script is used to create and configure the QZP token. It:
  - Creates a new token mint with extensions (metadata, group, member, close, permanent delegate).
  - Initializes token metadata (name, symbol, URI).
  -	Creates an associated token account for the admin.
  -	Mints the initial supply to the admin’s account.
  -	Revokes mint authority to lock the supply.
