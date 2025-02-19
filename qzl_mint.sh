#!/bin/bash
set -e

# Configuration variables (can be overridden via environment variables)
# Check `justfile` for the default values.
ADMIN_KEYPAIR="${ADMIN_KEYPAIR:-~/.config/solana/id.json}"
TOKEN_NAME="${TOKEN_NAME:-QZL Token}"
TOKEN_SYMBOL="${TOKEN_SYMBOL:-QZL}"
TOKEN_URI="${TOKEN_URI:-https://raw.githubusercontent.com/jorzhikgit/QZL/main/metadata.json}"
INITIAL_SUPPLY="${INITIAL_SUPPLY:-420000000}"
NETWORK="${NETWORK:--u localhost}"
DECIMALS="${DECIMALS:-0}"
DEFAULT_ATA_SIZE=170 # default size for assocaited token account (Token-2022 standard)

ADMIN_BALANCE_PRE=$(solana balance --output json | jq -r '.lamports' | awk '{printf "%.9f\n", $1/1000000000}')
echo
echo "Initial wallet balance: $ADMIN_BALANCE_PRE SOL"

# Create the token mint with extensions enabled.
echo
echo "Creating token mint with extensions..."
CREATE_OUT=$(spl-token create-token \
  --enable-metadata --program-2022 --enable-group \
  --enable-member --enable-close --enable-permanent-delegate \
  --decimals $DECIMALS --mint-authority $ADMIN_KEYPAIR $NETWORK)
# Extract the token mint address from the output.
TOKEN_MINT=$(echo "$CREATE_OUT" | grep "Address" | awk '{print $NF}')
echo "Token mint created."

# Initialize the metadata on the token mint.
echo "Initializing metadata for token mint..."
spl-token initialize-metadata "$TOKEN_MINT" "$TOKEN_NAME" "$TOKEN_SYMBOL" "$TOKEN_URI" \
  --mint-authority $ADMIN_KEYPAIR --program-2022 $NETWORK > /dev/null 2>&1
echo "Metadata initialized."

# Create the associated token account for the admin.
echo "Creating admin associated token account..."
CREATE_OUT=$(spl-token create-account "$TOKEN_MINT" $NETWORK)
ADMIN_TOKEN_ACCOUNT=$(echo "$CREATE_OUT" | head -n1 | awk '{print $3}')
echo "Admin associated token account created."

# Check the admin token account's SOL balance and fund it if needed.
echo "Ensuring admin token account is rent-exempt..."
# Dynamically get the account size from on-chain data.
ACCOUNT_SIZE=$(solana account "$ADMIN_TOKEN_ACCOUNT" "$NETWORK" --output json | jq -r '.account.space')
if [ -z "$ACCOUNT_SIZE" ] || [ "$ACCOUNT_SIZE" = "null" ]; then
  echo "Unable to determine account size; defaulting to ${DEFAULT_ATA_SIZE} bytes." >&2
  ACCOUNT_SIZE=$DEFAULT_ATA_SIZE
fi

# Get the minimum lamports required for rent exemption for the given account size.
MIN_BALANCE=$(solana rent "$ACCOUNT_SIZE" --output json | jq -r '.rentExemptMinimumLamports')
# Extract the current lamports balance of the token account.
CURRENT_BALANCE=$(solana balance "$ADMIN_TOKEN_ACCOUNT" --lamports | awk '{print $1}')
if [ "$CURRENT_BALANCE" = "null" ] || [ -z "$CURRENT_BALANCE" ]; then
  CURRENT_BALANCE=0
fi

# If the current balance is less than the required minimum, transfer the difference.
if [ "$CURRENT_BALANCE" -lt "$MIN_BALANCE" ]; then
  DIFF=$(($MIN_BALANCE - $CURRENT_BALANCE))
  echo "Account balance ($CURRENT_BALANCE lamports) is less than required ($MIN_BALANCE lamports)."
  echo "Funding token account with $DIFF lamports..."
  solana transfer "$ADMIN_TOKEN_ACCOUNT" "$DIFF" --from "$ADMIN_KEYPAIR" $NETWORK --allow-unfunded-recipient --commitment confirmed > /dev/null 2>&1
fi
echo "Rent-exemption ensured."

# Mint the specified initial supply to the admin token account.
echo "Minting initial supply ($INITIAL_SUPPLY) to admin token account..."
spl-token mint "$TOKEN_MINT" $INITIAL_SUPPLY "$ADMIN_TOKEN_ACCOUNT" $NETWORK > /dev/null 2>&1
echo "Tokens minted."

# Revoke the mint authority to lock the total supply.
echo "Revoking mint authority to lock the supply..."
spl-token authorize "$TOKEN_MINT" mint --disable $NETWORK > /dev/null 2>&1
echo "Mint authority revoked."

echo
echo "----------"
echo "QZL Mint address: $TOKEN_MINT"
echo "Admin token account (initial supply account): $ADMIN_TOKEN_ACCOUNT"
echo "----------"
echo

# Wallet balance after token/associated token account creation
ADMIN_BALANCE_AFTER=$(solana balance --output json | jq -r '.lamports' | awk '{printf "%.9f\n", $1/1000000000}')
echo "SOL spent: $(echo "$ADMIN_BALANCE_PRE - $ADMIN_BALANCE_AFTER" | bc)"

echo "Token setup complete."
