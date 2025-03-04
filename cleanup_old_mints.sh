#!/usr/bin/env bash
set -e

# NOTE: We're !ONLY burning tokens from the Treasury, Team, and DEX accounts. As `mintAuthority` of these tokens was disabled
MINTS=(
  "6KcaxPFmAkEx9Wc9n9jGjWQQzPojJUm5Drku44RCFMWd" 
  "6c9GLgX7W9aEctjdJrfcwQS2YhMwP3DsmzNQgmsBhL6J"
)

# NOTE: Put private keys in the same direcotry! (DEX, TREASURY, TEAM, OWNER OF MINT - private keys)
KEYPAIRS_DIR="/Users/nshv/Library/Mobile Documents/iCloud~md~obsidian/Documents/Work/Nyoka/qzl_test"

cd $KEYPAIRS_DIR || exit
# NOTE: Path to treasury PRIVATE key (pubkey - 6srFBZBatJKoQhL8GU1XTgjX26MhbUecXiaZWA1nUikb)
TREASURY_KEYPAIR="treasure.json"
# NOTE: Path to team PRIVATE key (pubkey - CbTTRiuStnDDoAARpAnXBGjC1Go4ftk8P2dPdW52soxS)
TEAM_KEYPAIR="team.json"
# NOTE: Path to dex PRIVATE key (pubkey - 8q3P4ozJCHPMT7imummr4JFLHoXXD61vjz3o5KYdHewK)
DEX_KEYPAIR="dex.json"
# NOTE: Path to payer PRIVATE key (pubkey - 2dgctKxMBz2aNsAVLpUgnBeDTFuaMGrHm9FSxGMkyPCi)
PAYER_KEYPAIR="head_admin.json"

TREASURY=$(solana-keygen pubkey "$TREASURY_KEYPAIR")
TEAM=$(solana-keygen pubkey "$TEAM_KEYPAIR")
DEX=$(solana-keygen pubkey "$DEX_KEYPAIR")

# Change to the correct cluster if needed: e.g. -u mainnet, -u devnet, etc.
NETWORK="-ul"

# ------------------------------
# 2) Function to burn+close a single token account
# ------------------------------
burn_and_close_account() {
  local MINT_ADDR="$1"
  local OWNER="$2"
  local TOKEN_ACCOUNT="$3"

  echo "Checking balance of $TOKEN_ACCOUNT for mint $MINT_ADDR..."
  BALANCE=$(spl-token balance --address "$TOKEN_ACCOUNT" --program-2022 $NETWORK 2>/dev/null || echo "0")
  echo "  Balance = $BALANCE"

 MINT_DECIMALS=$(spl-token account-info --address "$TOKEN_ACCOUNT" "$NETWORK" --output json | jq -r '.tokenAmount.decimals')

  if [[ "$BALANCE" != "0" && "$BALANCE" != "" ]]; then
    echo "Burning $BALANCE tokens from $TOKEN_ACCOUNT..."
    spl-token burn "$TOKEN_ACCOUNT" "$BALANCE" \
      --owner "$OWNER" \
      --fee-payer "$PAYER_KEYPAIR " \
      --program-2022 \
      $NETWORK
  fi

  echo "Closing token account $TOKEN_ACCOUNT..."
  spl-token close \
    --address "$TOKEN_ACCOUNT" \
    --owner "$OWNER" \
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

  # WARN: NOT POSSIBLE AS MINT AUTHORITY IS DISABLED ON THE MINTS
  # echo "Attempting to close mint $MINT..."
  # spl-token close-mint "$MINT" \
  #   --owner "$PAYER_KEYPAIR" \
  #   --fee-payer "$PAYER_KEYPAIR" \
  #   --program-2022 \
  #   $NETWORK || echo "  Could not close mint $MINT (no close authority or supply not zero)."
done

echo "All done!"
