# QZL Token Project

Available commands:
```shell
$ just create-token                      # Create QZL token (mint, metadata, supply, revoke authority). Defaults to localnet.
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
  - QZL token-based voting system.

## QZL Token Program
- Implements the **QZL token** using Solana's Token-2022 standard.
- Key responsibilities:
  - Creates the QZL token mint with an initial supply of **450 million tokens**.
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

### The qzl_mint.sh script is used to create and configure the QZL token. It:
  - Creates a new token mint with extensions (metadata, group, member, close, permanent delegate).
  - Initializes token metadata (name, symbol, URI).
  -	Creates an associated token account for the admin.
  -	Mints the initial supply to the admin’s account.
  -	Revokes mint authority to lock the supply.

```bash
#!/bin/bash
set -e

# --- Configuration Variables. Designed to be called using `just` tool ---
ADMIN_KEYPAIR="${ADMIN_KEYPAIR:-/~/.config/solana/id.json}"
TOKEN_NAME="${TOKEN_NAME:-QZL Token}"
TOKEN_SYMBOL="${TOKEN_SYMBOL:-QZL}"
TOKEN_URI="${TOKEN_URI:-https://raw.githubusercontent.com/jorzhikgit/QZL/main/metadata.json}"
INITIAL_SUPPLY="${INITIAL_SUPPLY:-450000000}"
NETWORK="${NETWORK:--u localhost}"
DECIMALS="${DECIMALS:-0}"

# --- Step 1: Create the token mint ---
# This command creates a token with metadata, group, member, close, and permanent delegate extensions enabled.
echo
echo "Creating token mint with extensions..."
# spl-token create-token --enable-metadata --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb -ul
CREATE_OUT=$(spl-token create-token \
  --enable-metadata --program-2022 --enable-group \
  --enable-member --enable-close --enable-permanent-delegate \
  --decimals $DECIMALS --mint-authority $ADMIN_KEYPAIR $NETWORK)

# Parse the created token mint address from the output (assumes it appears as the last word on the "Creating token" line)
TOKEN_MINT=$(echo "$CREATE_OUT" | grep "Address" | awk '{print $NF}')
echo "Done."

# --- Step 2: Initialize the metadata ---
echo "Initializing metadata for token mint..."
CREATE_OUT=$(spl-token initialize-metadata \
  "$TOKEN_MINT" "$TOKEN_NAME" "$TOKEN_SYMBOL" "$TOKEN_URI" \
  --mint-authority $ADMIN_KEYPAIR --program-2022 $NETWORK)
echo "Done."

# --- Step 3: Create an associated token account for the admin ---
echo "Creating admin associated token account..."
CREATE_OUT=$(spl-token create-account "$TOKEN_MINT" $NETWORK)
ADMIN_TOKEN_ACCOUNT=$(echo "$CREATE_OUT" | head -n1 | awk '{print $3}')
echo "Done."

# --- Step 4: Mint the initial supply to the admin token account ---
echo "Minting initial supply ($INITIAL_SUPPLY) to admin token account..."
CREATE_OUT=$(spl-token mint "$TOKEN_MINT" $INITIAL_SUPPLY "$ADMIN_TOKEN_ACCOUNT" $NETWORK)
echo "Done."

# --- Step 5: Revoke mint authority to fix the total supply ---
echo "Revoking mint authority to lock the supply..."
CREATE_OUT=$(spl-token authorize "$TOKEN_MINT" mint --disable $NETWORK)
echo "Done."

echo
echo "Mint address: $TOKEN_MINT"
echo "Admin token account: $ADMIN_TOKEN_ACCOUNT"
echo

echo "Token setup complete."
```
