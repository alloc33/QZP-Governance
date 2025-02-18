#!/bin/bash
set -e

# --- Configuration Variables. Designed to be called using `just` tool ---
ADMIN_KEYPAIR="${ADMIN_KEYPAIR:-~/.config/solana/id.json}"
TOKEN_NAME="${TOKEN_NAME:-QZL Token}"
TOKEN_SYMBOL="${TOKEN_SYMBOL:-QZL}"
TOKEN_URI="${TOKEN_URI:-https://raw.githubusercontent.com/jorzhikgit/QZL/main/metadata.json}"
INITIAL_SUPPLY="${INITIAL_SUPPLY:-450000000}"
NETWORK="${NETWORK:--u localhost}"
DECIMALS="${DECIMALS:-0}"

# --- Step 1: Create the token mint ---
echo
echo "Creating token mint with extensions..."
CREATE_OUT=$(spl-token create-token \
  --enable-metadata --program-2022 --enable-group \
  --enable-member --enable-close --enable-permanent-delegate \
  --decimals $DECIMALS --mint-authority $ADMIN_KEYPAIR $NETWORK)
# Parse the created token mint address from the output
TOKEN_MINT=$(echo "$CREATE_OUT" | grep "Address" | awk '{print $NF}')
echo "Done."

# --- Step 2: Initialize the metadata ---
echo "Initializing metadata for token mint..."
spl-token initialize-metadata "$TOKEN_MINT" "$TOKEN_NAME" "$TOKEN_SYMBOL" "$TOKEN_URI" \
  --mint-authority $ADMIN_KEYPAIR --program-2022 $NETWORK > /dev/null 2>&1
echo "Done."

# --- Step 3: Create an associated token account for the admin ---
echo "Creating admin associated token account..."
CREATE_OUT=$(spl-token create-account "$TOKEN_MINT" $NETWORK)
ADMIN_TOKEN_ACCOUNT=$(echo "$CREATE_OUT" | head -n1 | awk '{print $3}')
echo "Done."

# --- Step 4: Ensure the admin token account is rent-exempt ---
echo "Ensuring admin token account is rent-exempt..."

# Assume token account size is 165 bytes.
MIN_BALANCE=$(solana rent 165 --output json | jq -r '.rentExemptMinimumLamports')

# Use awk to extract just the numeric portion from the balance output.
CURRENT_BALANCE=$(solana balance "$ADMIN_TOKEN_ACCOUNT" --lamports | awk '{print $1}')
CURRENT_BALANCE=${CURRENT_BALANCE:-0}

if [ "$CURRENT_BALANCE" -lt "$MIN_BALANCE" ]; then
  DIFF=$(($MIN_BALANCE - $CURRENT_BALANCE))
  echo "Token account funding..."
  solana transfer "$ADMIN_TOKEN_ACCOUNT" "$DIFF" --from "$ADMIN_KEYPAIR" $NETWORK --allow-unfunded-recipient --commitment confirmed > /dev/null 2>&1
fi
echo "Done."

# --- Step 5: Mint the initial supply to the admin token account ---
echo "Minting initial supply ($INITIAL_SUPPLY) to admin token account..."
spl-token mint "$TOKEN_MINT" $INITIAL_SUPPLY "$ADMIN_TOKEN_ACCOUNT" $NETWORK > /dev/null 2>&1
echo "Done."

# --- Step 6: Revoke mint authority to fix the total supply ---
echo "Revoking mint authority to lock the supply..."
spl-token authorize "$TOKEN_MINT" mint --disable $NETWORK > /dev/null 2>&1
echo "Done."

echo
echo "Mint address: $TOKEN_MINT"
echo "Admin token account: $ADMIN_TOKEN_ACCOUNT"
echo

echo "Token setup complete."
