#!/bin/bash
set -e

# ==========================
# CONFIGURATION
# ==========================
# Path to the deploy wallet keypair. This wallet is used exclusively for paying transaction fees
# and signing operations during deployment.
DEPLOY_WALLET="${DEPLOY_WALLET:-/Users/nshv/solana/qzl_deploy_wallet.json}"
# The admin public key. This account will ultimately control the token and its associated accounts.
ADMIN_PUBKEY="2dgctKxMBz2aNsAVLpUgnBeDTFuaMGrHm9FSxGMkyPCi"

# Distribution percentages:
# - Treasury: 80%
# - Team: 10%
# - DEX: 10%
TREASURY_PUBKEY="6srFBZBatJKoQhL8GU1XTgjX26MhbUecXiaZWA1nUikb"
TEAM_PUBKEY="CbTTRiuStnDDoAARpAnXBGjC1Go4ftk8P2dPdW52soxS"
DEX_PUBKEY="8q3P4ozJCHPMT7imummr4JFLHoXXD61vjz3o5KYdHewK"

# Token parameters
TOKEN_NAME="${TOKEN_NAME:-QZL Token}"
TOKEN_SYMBOL="${TOKEN_SYMBOL:-QZL}"
TOKEN_URI="${TOKEN_URI:-https://raw.githubusercontent.com/jorzhikgit/QZL/main/metadata.json}"
INITIAL_SUPPLY="${INITIAL_SUPPLY:-420000000}"
NETWORK="${NETWORK:--u devnet}"
DECIMALS="${DECIMALS:-0}"
DEFAULT_ATA_SIZE=170  # Default size for a Token-2022 associated token account.

# Configure the Solana CLI to use the deploy wallet as the default keypair.
solana config set --keypair "$DEPLOY_WALLET" > /dev/null

echo "Using deploy wallet: $DEPLOY_WALLET"
echo "Using admin pubkey:  $ADMIN_PUBKEY"

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
TOKEN_MINT=$(echo "$CREATE_OUT" | grep "Address" | awk '{print $NF}')
echo "Token mint = $TOKEN_MINT"

# ==========================
# 2) INITIALIZE METADATA
# ==========================
echo "Initializing metadata for the token mint..."
spl-token initialize-metadata "$TOKEN_MINT" "$TOKEN_NAME" "$TOKEN_SYMBOL" "$TOKEN_URI" \
  --fee-payer "$DEPLOY_WALLET" \
  --mint-authority "$DEPLOY_WALLET" \
  --program-2022 \
  $NETWORK

# ==========================
# 3) CREATE TEMPORARY TOKEN ACCOUNT
# ==========================
echo "Creating a temporary token account (owned by the deploy wallet) for initial minting..."
CREATE_ATA_OUT=$(spl-token create-account "$TOKEN_MINT" \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$(solana address --keypair "$DEPLOY_WALLET")" \
  $NETWORK)
TEMP_ATA=$(echo "$CREATE_ATA_OUT" | head -n1 | awk '{print $3}')
echo "Temporary ATA = $TEMP_ATA"

# ==========================
# 4) ENSURE RENT EXEMPTION FOR TEMP ATA
# ==========================
echo "Verifying that the temporary ATA is rent-exempt..."
ACCOUNT_SIZE=$(solana account "$TEMP_ATA" $NETWORK --output json | jq -r '.account.space // 170')
MIN_BALANCE=$(solana rent "$ACCOUNT_SIZE" --output json | jq -r '.rentExemptMinimumLamports')
CURRENT_BALANCE=$(solana balance "$TEMP_ATA" --lamports --keypair "$DEPLOY_WALLET" $NETWORK | awk '{print $1}')
if [ -z "$CURRENT_BALANCE" ] || [ "$CURRENT_BALANCE" = "null" ]; then
  CURRENT_BALANCE=0
fi
if [ "$CURRENT_BALANCE" -lt "$MIN_BALANCE" ]; then
  DIFF=$(( MIN_BALANCE - CURRENT_BALANCE ))
  echo "Funding $TEMP_ATA with $DIFF lamports to ensure rent exemption..."
  solana transfer "$TEMP_ATA" "$DIFF" \
    --fee-payer "$DEPLOY_WALLET" \
    --from "$DEPLOY_WALLET" \
    $NETWORK --allow-unfunded-recipient --commitment confirmed
fi

# ==========================
# 5) MINT INITIAL SUPPLY TO TEMP ATA
# ==========================
echo "Minting $INITIAL_SUPPLY tokens to the temporary ATA..."
spl-token mint "$TOKEN_MINT" "$INITIAL_SUPPLY" "$TEMP_ATA" \
  --fee-payer "$DEPLOY_WALLET" \
  --mint-authority "$DEPLOY_WALLET" \
  $NETWORK

# ==========================
# 6) DISTRIBUTE TOKENS TO TREASURY, TEAM, AND DEX
# ==========================
echo "Distributing tokens from the temporary ATA..."

# Calculate distribution amounts based on the specified percentages.
TREASURY_AMOUNT=$(echo "$INITIAL_SUPPLY * 80 / 100" | bc)
TEAM_AMOUNT=$(echo "$INITIAL_SUPPLY * 10 / 100" | bc)
DEX_AMOUNT=$(echo "$INITIAL_SUPPLY * 10 / 100" | bc)

echo "Creating treasury token account..."
TREASURY_OUT=$(spl-token create-account "$TOKEN_MINT" \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$TREASURY_PUBKEY" \
  $NETWORK)
TREASURY_ATA=$(echo "$TREASURY_OUT" | head -n1 | awk '{print $3}')
echo "Treasury ATA = $TREASURY_ATA"

echo "Creating team token account..."
TEAM_OUT=$(spl-token create-account "$TOKEN_MINT" \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$TEAM_PUBKEY" \
  $NETWORK)
TEAM_ATA=$(echo "$TEAM_OUT" | head -n1 | awk '{print $3}')
echo "Team ATA = $TEAM_ATA"

echo "Creating DEX token account..."
DEX_OUT=$(spl-token create-account "$TOKEN_MINT" \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$DEX_PUBKEY" \
  $NETWORK)
DEX_ATA=$(echo "$DEX_OUT" | head -n1 | awk '{print $3}')
echo "DEX ATA = $DEX_ATA"

echo "Transferring $TREASURY_AMOUNT tokens to Treasury..."
spl-token transfer "$TOKEN_MINT" "$TREASURY_AMOUNT" "$TREASURY_ATA" \
  --fee-payer "$DEPLOY_WALLET" $NETWORK

echo "Transferring $TEAM_AMOUNT tokens to Team..."
spl-token transfer "$TOKEN_MINT" "$TEAM_AMOUNT" "$TEAM_ATA" \
  --fee-payer "$DEPLOY_WALLET" $NETWORK

echo "Transferring $DEX_AMOUNT tokens to DEX..."
spl-token transfer "$TOKEN_MINT" "$DEX_AMOUNT" "$DEX_ATA" \
  --fee-payer "$DEPLOY_WALLET" $NETWORK

# ==========================
# 7) TRANSFER AUTHORITIES TO ADMIN & DISABLE MINTING
# ==========================
echo "Transferring group-member-pointer authority to the admin account..."
spl-token authorize "$TOKEN_MINT" group-member-pointer "$ADMIN_PUBKEY" \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$DEPLOY_WALLET" \
  $NETWORK

echo "Transferring metadata pointer authority to the admin account..."
spl-token authorize "$TOKEN_MINT" metadata-pointer "$ADMIN_PUBKEY" \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$DEPLOY_WALLET" \
  $NETWORK

echo "Transferring metadata update authority to the admin account..."
spl-token authorize "$TOKEN_MINT" metadata "$ADMIN_PUBKEY" \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$DEPLOY_WALLET" \
  $NETWORK

echo "Disabling mint authority to lock further token minting..."
spl-token authorize "$TOKEN_MINT" mint --disable \
  --fee-payer "$DEPLOY_WALLET" \
  --owner "$DEPLOY_WALLET" \
  $NETWORK

# ==========================
# 8) FINAL REPORT
# ==========================
echo "----------------------------------------"
echo "Final Token Setup Report:"
echo "Token Mint Address:        $TOKEN_MINT"
echo "Treasury Token Account:    $TREASURY_ATA"
echo "Team Token Account:        $TEAM_ATA"
echo "DEX Token Account:         $DEX_ATA"
echo "----------------------------------------"

DEPLOY_BALANCE_POST=$(solana balance --keypair "$DEPLOY_WALLET" --output json | jq -r '.lamports' | awk '{printf "%.9f", $1/1000000000}')
SPENT=$(echo "$DEPLOY_BALANCE_PRE - $DEPLOY_BALANCE_POST" | bc)
echo "SOL spent by deploy wallet: $SPENT"

# ==========================
# 9) TOKEN BALANCE REPORT
# ==========================
echo "-------------------------------"
echo "Token Balance Report:"
echo "Temporary ATA balance: $(spl-token balance --address "$TEMP_ATA" --program-2022 $NETWORK 2>/dev/null || echo "0")"
echo "Treasury ATA balance:  $(spl-token balance --address "$TREASURY_ATA" --program-2022 $NETWORK 2>/dev/null || echo "0")"
echo "Team ATA balance:      $(spl-token balance --address "$TEAM_ATA" --program-2022 $NETWORK 2>/dev/null || echo "0")"
echo "DEX ATA balance:       $(spl-token balance --address "$DEX_ATA" --program-2022 $NETWORK 2>/dev/null || echo "0")"
echo "Admin token accounts (should be empty):"
spl-token accounts --owner "$ADMIN_PUBKEY" --program-2022 $NETWORK || echo "No admin token accounts found."
echo "-------------------------------"

# ==========================
# 10) MINT ACCOUNT DETAILS
# ==========================
echo "Mint Account Information:"
spl-token display "$TOKEN_MINT" --program-2022 $NETWORK

echo
echo "Token setup complete."
echo "Distribution complete: Treasury (80%), Team (10%), DEX (10%)."
echo "Admin account now controls all rights over the token, and no further tokens can be minted."
