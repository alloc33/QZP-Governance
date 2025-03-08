# Justfile for QZL Token CLI

# Constants
cli            := "cargo run --bin qzl-cli --release"
env_path       := "~/.config/solana"

# Configuration Variables
DEPLOY_WALLET  := "/Users/nshv/.config/solana/qzl_deploy_wallet.json"
ADMIN_KEYPAIR  := "/Users/nshv/.config/solana/id.json"
TOKEN_NAME     := "Quantzilla Labs"
TOKEN_SYMBOL   := "QZL"
TOKEN_URI      := "https://raw.githubusercontent.com/tisitw39/QZL-Metadata/main/metadata.json"
INITIAL_SUPPLY := "420000000"
NETWORK        := "-ul" # (`l` - localnet, `d` - devnet etc)
DECIMALS       := "9"

_default:
    just --list

# Initialize the VoteManager
initialize-voting:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} \
    NETWORK={{NETWORK}} \
    {{cli}} initialize_voting

# Add a project to a voting round
add-project project_key:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} \
    NETWORK={{NETWORK}} \
    {{cli}} add_project {{project_key}}

# Change the voting fee
change-fee new_fee:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} \
    NETWORK={{NETWORK}} \
    {{cli}} change_fee {{new_fee}}

# Get the current voting round
get-round:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} \
    NETWORK={{NETWORK}} \
    {{cli}} get_round

# Increment the current voting round
increment-round:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} \
    NETWORK={{NETWORK}} \
    {{cli}} increment_round

# Cast a vote for a project in a specific round
do-vote project_name voter_keypair_path:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} \
    NETWORK={{NETWORK}} \
    {{cli}} do_vote {{project_name}} {{voter_keypair_path}}

# Get the current voting fee
get-fee:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} \
    NETWORK={{NETWORK}} \
    {{cli}} get_fee

# Get the current voting fee
get-vote-count project_key:
    ADMIN_SECRET={{ADMIN_KEYPAIR}} \
    NETWORK={{NETWORK}} \
    {{cli}} get_vote_count {{project_key}}

##################################################
# Create QZL Token by running the minting script with environment variables
create-token: 
    DEPLOY_WALLET="{{DEPLOY_WALLET}}" \
    TOKEN_NAME="{{TOKEN_NAME}}" \
    TOKEN_SYMBOL="{{TOKEN_SYMBOL}}" \
    TOKEN_URI="{{TOKEN_URI}}" \
    INITIAL_SUPPLY="{{INITIAL_SUPPLY}}" \
    NETWORK="{{NETWORK}}" \
    DECIMALS="{{DECIMALS}}" \
    ./qzl_mint.sh

# Utility to print available commands
help:
    just --list
