import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { VoteProject } from '../target/types/vote_project';

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.VoteProject as Program<VoteProject>;

// Client

