#!/usr/bin/env bash
set -e

# Network or CLI flags (for mainnet: -um, devnet: -ud, etc.)
NETWORK="${NETWORK:--ul}"

# ------------------------------
# 1) CONFIGURATION
# ------------------------------
# List of mint addresses (old token versions to burn)
MINTS=(
  "5HtCRjHYfW7oLM3Nu1SQ5wE5c9dLKSKHJ1xDFkBkxoUt" 
  "Hdbhh2u3Q7CNFAxrLtAbxpGZtbGV8hpo9Aa1yFjQMtZu"
)

AUTHORITY_KEYPAIR="${AUTHORITY_KEYPAIR:-/path/to/authority/keypair.json}"

# Keypairs for treasury, team, dex owners (for burning their accounts)
TREASURY_KEYPAIR="${TREASURY_KEYPAIR:-/path/to/treasury/keypair.json}"
TEAM_KEYPAIR="${TEAM_KEYPAIR:-/path/to/team/keypair.json}"
DEX_KEYPAIR="${DEX_KEYPAIR:-/path/to/dex/keypair.json}"

# Derive public keys (used to look up associated token accounts)
TREASURY=$(solana-keygen pubkey "$TREASURY_KEYPAIR")
TEAM=$(solana-keygen pubkey "$TEAM_KEYPAIR")
DEX=$(solana-keygen pubkey "$DEX_KEYPAIR")

# ------------------------------
# 2) Function: Burn Tokens and Close a Token Account
# ------------------------------
burn_and_close_account() {
  local MINT_ADDR="$1"       # The mint address (for reference)
  local KEYPAIR="$2"         # Keypair file for the token account owner
  local TOKEN_ACCOUNT="$3"   # Associated token account address

  echo "------------------------------------"
  echo "Processing token account: $TOKEN_ACCOUNT for mint: $MINT_ADDR"
  
  # Retrieve the token balance (if the account exists)
  BALANCE=$(spl-token balance --address "$TOKEN_ACCOUNT" --program-2022 $NETWORK 2>/dev/null || echo "0")
  echo "  Balance = $BALANCE"

  if [[ "$BALANCE" != "0" && "$BALANCE" != "" ]]; then
    echo "Burning $BALANCE tokens from $TOKEN_ACCOUNT..."
    spl-token burn "$TOKEN_ACCOUNT" "$BALANCE" \
      --owner "$KEYPAIR" \
      --fee-payer "$AUTHORITY_KEYPAIR" \
      --program-2022 \
      $NETWORK
  fi

  echo "Closing token account $TOKEN_ACCOUNT..."
  spl-token close \
    --address "$TOKEN_ACCOUNT" \
    --owner "$KEYPAIR" \
    --fee-payer "$AUTHORITY_KEYPAIR" \
    --program-2022 \
    $NETWORK || echo "  Could not close $TOKEN_ACCOUNT (possibly already closed)."
}

# ------------------------------
# 3) Main Loop - Burn & Close for each Mint
# ------------------------------
for MINT in "${MINTS[@]}"; do
  echo "===================================="
  echo "Processing MINT: $MINT"
  echo "===================================="

  # a) Burn & close the Treasury, Team, and DEX accounts

  TREASURY_ATA=$(spl-token address --owner $TREASURY --token $MINT --program-2022 --verbose $NETWORK --output json | jq -r '.associatedTokenAddress')
  DEX_ATA=$(spl-token address --owner $DEX --token $MINT --program-2022 --verbose $NETWORK --output json | jq -r '.associatedTokenAddress')
  TEAM_ATA=$(spl-token address --owner $TEAM --token $MINT --program-2022 --verbose $NETWORK --output json | jq -r '.associatedTokenAddress')

  burn_and_close_account "$MINT" $TREASURY_KEYPAIR $TREASURY_ATA
  burn_and_close_account "$MINT" $DEX_KEYPAIR $DEX_ATA
  burn_and_close_account "$MINT" $TEAM_KEYPAIR $TEAM_ATA
done

echo "All token burn operations completed!"

####################################################################
# CHANGE NAME, SYMBOL AND URI FOR OLD MINTS - MAKE THEM DEPRECATED #
####################################################################

# Update 1 field at time for each mint
echo "Deprecating the following mints: ${MINTS[*]}"
echo "Using fee-payer keypair: $AUTHORITY_KEYPAIR"
echo "Network flag: $NETWORK"

for mint in "${MINTS[@]}"; do
  echo "----------------------------------------"
  echo "Deprecating mint: $mint"
  echo "----------------------------------------"

  # Update the token name to "deprecated"
  spl-token update-metadata "$mint" name "deprecated" \
    --authority "$AUTHORITY_KEYPAIR" \
    --fee-payer "$AUTHORITY_KEYPAIR" \
    --program-2022 \
    $NETWORK

  # Update the token symbol to "deprecated"
  spl-token update-metadata "$mint" symbol "deprecated" \
    --authority "$AUTHORITY_KEYPAIR" \
    --fee-payer "$AUTHORITY_KEYPAIR" \
    --program-2022 \
    $NETWORK

  # Clear the metadata URI
  spl-token update-metadata "$mint" uri "" \
    --authority "$AUTHORITY_KEYPAIR" \
    --fee-payer "$AUTHORITY_KEYPAIR" \
    --program-2022 \
    $NETWORK 
done

echo "Metadata updates complete for all mints."
