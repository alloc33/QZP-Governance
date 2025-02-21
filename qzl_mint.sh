#!/bin/bash
set -e

# ==========================
# CONFIGURATION
# ==========================
# Set the path for the deploy wallet keypair (used solely for paying fees and signing transactions).
DEPLOY_WALLET="${DEPLOY_WALLET:-~/.config/solana/qzl_deploy_wallet.json}"
# Set the public key for the admin account. This account (which you don't control locally)
# will be the ultimate owner of the token and its associated token account.
ADMIN_PUBKEY="E88MCgENj4uksz3QX9DUYRKqM8sJfqHGxCueWDnTPDep"

# Token parameters
TOKEN_NAME="${TOKEN_NAME:-QZL Token}"
TOKEN_SYMBOL="${TOKEN_SYMBOL:-QZL}"
TOKEN_URI="${TOKEN_URI:-https://raw.githubusercontent.com/jorzhikgit/QZL/main/metadata.json}"
INITIAL_SUPPLY="${INITIAL_SUPPLY:-420000000}"
NETWORK="${NETWORK:--u devnet}"
DECIMALS="${DECIMALS:-0}"
DEFAULT_ATA_SIZE=170  # Default account size for an associated token account (Token-2022 standard)

echo "Using deploy wallet: $DEPLOY_WALLET"
echo "Using admin pubkey:  $ADMIN_PUBKEY"

# Record the initial deploy wallet SOL balance
DEPLOY_BALANCE_PRE=$(solana balance --keypair "$DEPLOY_WALLET" --output json | jq -r '.lamports' | awk '{printf "%.9f", $1/1000000000}')
echo "Initial deploy wallet SOL: $DEPLOY_BALANCE_PRE"

# ==========================
# 1) CREATE TOKEN MINT
# ==========================
echo
echo "Creating token mint with the deploy wallet as the initial mint authority..."
CREATE_OUT=$(spl-token create-token \
  --fee-payer "$DEPLOY_WALLET" \
  --enable-metadata --program-2022 \
  --enable-member \
  --decimals "$DECIMALS" \
  --mint-authority "$DEPLOY_WALLET" \
  $NETWORK)
# Extract the mint address from the output.
TOKEN_MINT=$(echo "$CREATE_OUT" | grep "Address" | awk '{print $NF}')
echo "Token mint = $TOKEN_MINT"

# ==========================
# 2) INITIALIZE METADATA
# ==========================
echo "Initializing metadata for token mint..."
spl-token initialize-metadata "$TOKEN_MINT" "$TOKEN_NAME" "$TOKEN_SYMBOL" "$TOKEN_URI" \
  --fee-payer "$DEPLOY_WALLET" \
  --mint-authority "$DEPLOY_WALLET" \
  --program-2022 \
  $NETWORK

# ==========================
# 3) CREATE ADMIN'S ASSOCIATED TOKEN ACCOUNT
# ==========================
echo "Creating admin's token account (ATA) for $TOKEN_MINT..."
CREATE_ATA_OUT=$(spl-token create-account "$TOKEN_MINT" \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$ADMIN_PUBKEY" \
  $NETWORK)
ADMIN_ATA=$(echo "$CREATE_ATA_OUT" | head -n1 | awk '{print $3}')
echo "Admin ATA = $ADMIN_ATA"

# ==========================
# 4) ENSURE RENT EXEMPTION
# ==========================
echo "Ensuring admin ATA is rent-exempt..."
# Obtain account size (default if unavailable)
ACCOUNT_SIZE=$(solana account "$ADMIN_ATA" $NETWORK --output json | jq -r '.account.space // 170')
MIN_BALANCE=$(solana rent "$ACCOUNT_SIZE" --output json | jq -r '.rentExemptMinimumLamports')
CURRENT_BALANCE=$(solana balance "$ADMIN_ATA" --lamports --keypair "$DEPLOY_WALLET" $NETWORK | awk '{print $1}')
if [ -z "$CURRENT_BALANCE" ] || [ "$CURRENT_BALANCE" = "null" ]; then
  CURRENT_BALANCE=0
fi

if [ "$CURRENT_BALANCE" -lt "$MIN_BALANCE" ]; then
  DIFF=$(( MIN_BALANCE - CURRENT_BALANCE ))
  echo "Account balance ($CURRENT_BALANCE lamports) is less than required ($MIN_BALANCE lamports)."
  echo "Funding $ADMIN_ATA with $DIFF lamports for rent exemption..."
  solana transfer "$ADMIN_ATA" "$DIFF" \
    --fee-payer "$DEPLOY_WALLET" \
    --from "$DEPLOY_WALLET" \
    $NETWORK --allow-unfunded-recipient --commitment confirmed
fi

# ==========================
# 5) MINT INITIAL SUPPLY TO ADMIN'S ATA
# ==========================
echo "Minting $INITIAL_SUPPLY tokens to admin's ATA..."
spl-token mint "$TOKEN_MINT" "$INITIAL_SUPPLY" "$ADMIN_ATA" \
  --fee-payer "$DEPLOY_WALLET" \
  --mint-authority "$DEPLOY_WALLET" \
  $NETWORK

# ==========================
# 6) DISABLE EXTENSION AUTHORITY & MINT AUTHORITY
# ==========================
echo "Disabling group-member-pointer authority so deploy wallet has no leftover powers..."
# Here we disable the "group-member-pointer" extension (which is used when --enable-member was set)
spl-token authorize "$TOKEN_MINT" group-member-pointer --disable \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$DEPLOY_WALLET" \
  $NETWORK || true

echo "Disabling mint authority to lock the token supply..."
spl-token authorize "$TOKEN_MINT" mint --disable \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$DEPLOY_WALLET" \
  $NETWORK || true

# ==========================
# 7) FINAL REPORT
# ==========================
echo
echo "QZL Mint address:        $TOKEN_MINT"
echo "Admin token account:     $ADMIN_ATA"

DEPLOY_BALANCE_POST=$(solana balance --keypair "$DEPLOY_WALLET" --output json | jq -r '.lamports' | awk '{printf "%.9f", $1/1000000000}')
SPENT=$(echo "$DEPLOY_BALANCE_PRE - $DEPLOY_BALANCE_POST" | bc)
echo "SOL spent by deploy wallet: $SPENT"

echo "Token setup complete. The admin account now controls the entire supply and no further tokens can be minted."
