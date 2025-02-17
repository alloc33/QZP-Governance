#!/bin/bash
set -e

# --- Configuration Variables ---
ADMIN_KEYPAIR="/Users/nshv/.config/solana/id.json"     # Must correspond to ADMIN_PUBKEY in your program
TOKEN_NAME="QZL Token"                            # Token name (used in metadata)
TOKEN_SYMBOL="QZL"                                # Token symbol (used in metadata)
TOKEN_URI="https://raw.githubusercontent.com/jorzhikgit/QZL/main/metadata.json"
INITIAL_SUPPLY=450000000                               # Adjust to desired initial token supply
NETWORK="-u localhost"                            # Use localnet; adjust if needed
DECIMALS=0

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
