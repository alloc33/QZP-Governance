!/usr/bin/env bash
set -e

# -----------------------------------------------------------------------------
# This script burns tokens (if any) from the Treasury, Team, and DEX 
# associated token accounts for two specific mints.
#
# IMPORTANT:
# - The mintAuthority for these mints has been disabled.
# - This script does NOT attempt to close the mint itself.
#
# For ease-of-use, place all your keypair files (treasure.json, team.json,
# dex.json, head_admin.json) in the same directory.
# 
# Public keys:
# treasury: 6srFBZ...
# team: CbTTRi...
# dex: 8q3P4o...
#
# -----------------------------------------------------------------------------

# Set the network (update this flag as needed: use "-um" for mainnet, "-ul" for localnet etc.)
NETWORK="-ul"

# ------------------------------
# 1) Configuration
# ------------------------------
# List of mint addresses (old token versions to burn)
MINTS=(
  "97Gb6GmL44Qpn1sWJTwj1vWwmZ5izMPaqB4CK8XULak" 
  "Dg9nA4THzRwC11TuAWH9RD1zjkoAnz15DbCj626Pkkaq"
)

# Directory where keypair JSON files are stored.
KEYPAIRS_DIR="/Users/nshv/Library/Mobile Documents/iCloud~md~obsidian/Documents/Work/Nyoka/qzl_test"

# Change to the keypairs directory
cd "$KEYPAIRS_DIR" || exit

# Private key files (ensure these files are present in KEYPAIRS_DIR)
TREASURY_KEYPAIR="treasure.json"    # Treasury account (pubkey: 6srFBZ...)
TEAM_KEYPAIR="team.json"            # Team account (pubkey: CbTTRi...)
DEX_KEYPAIR="dex.json"              # DEX account (pubkey: 8q3P4o...)
PAYER_KEYPAIR="head_admin.json"     # Payer account used for transaction fees

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
      --fee-payer "$PAYER_KEYPAIR" \
      --program-2022 \
      $NETWORK
  fi

  echo "Closing token account $TOKEN_ACCOUNT..."
  spl-token close \
    --address "$TOKEN_ACCOUNT" \
    --owner "$KEYPAIR" \
    --fee-payer "$PAYER_KEYPAIR" \
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
