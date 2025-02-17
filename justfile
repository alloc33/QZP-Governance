# Justfile for QZL Token CLI

# Constants
cli            := "cargo run --bin qzl-cli --release"
env_path       := "~/.config/solana"

# Configuration Variables
ADMIN_KEYPAIR  := "/Users/nshv/.config/solana/id.json"
TOKEN_NAME     := "QZL Token"
TOKEN_SYMBOL   := "QZL"
TOKEN_URI      := "https://raw.githubusercontent.com/jorzhikgit/QZL/main/metadata.json"
INITIAL_SUPPLY := "450000000"
NETWORK        := "-u localhost"
DECIMALS       := "0"

_default:
    just --list

# Create QZL Token by running the minting script with environment variables
create-token:
    ADMIN_KEYPAIR="{{ADMIN_KEYPAIR}}" \
    TOKEN_NAME="{{TOKEN_NAME}}" \
    TOKEN_SYMBOL="{{TOKEN_SYMBOL}}" \
    TOKEN_URI="{{TOKEN_URI}}" \
    INITIAL_SUPPLY="{{INITIAL_SUPPLY}}" \
    NETWORK="{{NETWORK}}" \
    DECIMALS="{{DECIMALS}}" \
    ./qzl_mint.sh

# Initialize the VoteManager forcefully
init-force:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} {{cli}} init_force

# Add a project to a voting round
add-project project_key round:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} {{cli}} add_project {{project_key}} {{round}}

# Change the voting fee
change-fee new_fee:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} {{cli}} change_fee {{new_fee}}

# Get the current voting round
get-round:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} {{cli}} get_round

# Increment the current voting round
increment-round:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} {{cli}} increment_round

# Cast a vote for a project in a specific round
do-vote project_name round:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} {{cli}} do_vote {{project_name}} {{round}}

# Utility to print available commands
help:
    just --list
