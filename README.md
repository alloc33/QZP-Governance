# QZL Token Project

This project is designed to empower community-driven decision-making on the Solana blockchain. It leverages the **QZL token** to facilitate transparent voting, allowing users to express their preferences on proposed projects without risking or burning their tokens. 
https://quantzillalabs.co

## Table of Contents

- [Business Logic](#business-logic)
  - [Governance Module](#governance-module)
  - [QZL Token Module](#qzl-token-module)
- [Testing](#testing)
  - [Test Cases](#test-cases)

---

## Business Logic

### Governance Module

The Governance module manages decentralized voting. It empowers administrators to oversee voting activities and ensures a transparent governance process.

#### Features:

1. **Admin Initialization**:
   - The governance system is initialized by an administrator with token mint, program, and fee configurations.

2. **Voting Round Management**:
   - Admins can increment voting rounds, enabling new voting phases while closing the previous ones.

3. **Fee Management**:
   - Admins set and modify voting fees to control voter participation and fund projects.

4. **Project Management**:
   - Admins add projects for voting, uniquely identified per round with associated fees.

5. **Voting Mechanism**:
   - Voters use QZL tokens to cast votes for projects during active rounds.
   - A voting fee is deducted from the voter and credited to the admin.

#### Workflow:

1. **Initialization**:
   - Admin initializes the system with the governance token mint, token program, and voting fee.

2. **Project Addition**:
   - Admins add projects tied to specific voting rounds.

3. **Voting**:
   - Voters cast votes, transferring the voting fee to the admin.

4. **Round Progression**:
   - Admins increment voting rounds, enabling new voting phases.

---

### QZL Token Module

The QZL Token module manages token minting, transfer, and governance. It integrates SPL Token-2022 extensions for advanced features.

#### Features:

1. **Token Minting**:
   - Mint accounts are created with metadata, fixed supply, and governance extensions.

2. **Token Transfers**:
   - Securely transfers QZL tokens between accounts.

3. **Extensions Handling**:
   - Includes metadata pointers, group memberships, and close authorities.

4. **Initial Supply Management**:
   - Initial tokens are minted to a supply manager account for controlled distribution.

#### Workflow:

1. **Mint Initialization**:
   - Admins create mint accounts with metadata and an initial token supply.

2. **Authority Management**:
   - Mint authority is revoked after initial minting to ensure a fixed supply.

3. **Token Transfers**:
   - QZL tokens are transferred securely from the supply manager to users or voters.

---

## Testing
- [x] Admin Initialization with Correct Admin Key
- [x] Admin Initialization with Incorrect Admin Key
- [x] Duplicate Initialization

Test Cases for increment_round Function:
- [x] Increment Round by Admin
- [x] Increment Round by Non-Admin

Test Cases for change_fee Function:
- [x] Admin Changes Fee
- [x] Non-Admin Tries to Change Fee

Test Cases for add_project Function:
- [x] Add Project with Unique idx
- [x] Add Project with Duplicate idx
- [x] Reuse idx in a New Round

Test Cases for do_vote Function
- [x] Double Voting Prevention
- [x] Voting in the Wrong Round
- [x] Voting Fee Transfer
- [x] Successful Vote
