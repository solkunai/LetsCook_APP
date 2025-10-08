import { 
  PublicKey, 
  TransactionInstruction, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { BorshCoder } from '@coral-xyz/anchor';
import { PROGRAM_ID } from './solana';

// Instruction discriminators (first 8 bytes of instruction data)
export const INSTRUCTION_DISCRIMINATORS = {
  INIT: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  CREATE_LAUNCH: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
  BUY_TICKETS: Buffer.from([232, 219, 183, 95, 204, 10, 142, 240]),
  CHECK_TICKETS: Buffer.from([100, 6, 61, 19, 142, 135, 200, 119]),
  CLAIM_TOKENS: Buffer.from([166, 6, 167, 213, 11, 117, 177, 8]),
  CLAIM_REFUND: Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]),
  HYPE_VOTE: Buffer.from([133, 164, 52, 200, 40, 98, 57, 6]),
  SET_NAME: Buffer.from([239, 41, 124, 174, 102, 206, 124, 142]),
  SWAP_COOK_AMM: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
  CREATE_RAYDIUM: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
  SWAP_RAYDIUM: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
} as const;

// Instruction data structures (matching your Rust program)
export interface CreateLaunchArgs {
  name: string;
  symbol: string;
  uri: string;
  icon: string;
  banner: string;
  totalSupply: number;
  decimals: number;
  launchDate: number;
  closeDate: number;
  numMints: number;
  ticketPrice: number;
  pageName: string;
  transferFee: number;
  maxTransferFee: number;
  extensions: number;
  ammProvider: number;
  launchType: number;
  whitelistTokens: number;
  whitelistEnd: number;
}

export interface BuyTicketsArgs {
  numTickets: number;
  seed: Uint8Array; // 32 bytes
}

export interface VoteArgs {
  launchType: number;
  vote: number;
}

export interface SetNameArgs {
  name: string;
}

export interface SwapArgs {
  side: number;
  inAmount: number;
  data?: Uint8Array;
}

// Helper function to create PDA
export async function findProgramAddress(
  seeds: (Buffer | Uint8Array)[],
  programId: PublicKey
): Promise<[PublicKey, number]> {
  return await PublicKey.findProgramAddress(seeds, programId);
}

// Create launch instruction
export async function createLaunchInstruction(
  args: CreateLaunchArgs,
  accounts: {
    user: PublicKey;
    listing: PublicKey;
    launchData: PublicKey;
    quoteTokenMint: PublicKey;
    launchQuote: PublicKey;
    cookData: PublicKey;
    cookPda: PublicKey;
    baseTokenMint: PublicKey;
    cookBaseToken: PublicKey;
    team: PublicKey;
    whitelist?: PublicKey;
    quoteTokenProgram: PublicKey;
    baseTokenProgram: PublicKey;
    associatedToken: PublicKey;
    systemProgram: PublicKey;
    delegate?: PublicKey;
    hook?: PublicKey;
  }
): Promise<TransactionInstruction> {
  const data = Buffer.alloc(1024); // Adjust size based on your args
  let offset = 0;
  
  // Write discriminator
  data.set(INSTRUCTION_DISCRIMINATORS.CREATE_LAUNCH, offset);
  offset += 8;
  
  // Write args (simplified - you'll need to implement proper serialization)
  // This is a placeholder - you should use Borsh serialization
  data.writeUInt32LE(args.totalSupply, offset);
  offset += 4;
  data.writeUInt32LE(args.ticketPrice, offset);
  offset += 4;
  // ... add other fields
  
  return new TransactionInstruction({
    keys: [
      { pubkey: accounts.user, isSigner: true, isWritable: true },
      { pubkey: accounts.listing, isSigner: false, isWritable: true },
      { pubkey: accounts.launchData, isSigner: false, isWritable: true },
      { pubkey: accounts.quoteTokenMint, isSigner: false, isWritable: true },
      { pubkey: accounts.launchQuote, isSigner: false, isWritable: true },
      { pubkey: accounts.cookData, isSigner: false, isWritable: true },
      { pubkey: accounts.cookPda, isSigner: false, isWritable: true },
      { pubkey: accounts.baseTokenMint, isSigner: false, isWritable: true },
      { pubkey: accounts.cookBaseToken, isSigner: false, isWritable: true },
      { pubkey: accounts.team, isSigner: false, isWritable: true },
      { pubkey: accounts.whitelist || SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.baseTokenProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.associatedToken, isSigner: false, isWritable: false },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.delegate || SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: accounts.hook || SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: data.slice(0, offset),
  });
}

// Buy tickets instruction
export async function createBuyTicketsInstruction(
  args: BuyTicketsArgs,
  accounts: {
    user: PublicKey;
    userData: PublicKey;
    joinData: PublicKey;
    launchData: PublicKey;
    launchQuote: PublicKey;
    fees: PublicKey;
    systemProgram: PublicKey;
    quoteTokenProgram: PublicKey;
    oraoRandom: PublicKey;
    oraoTreasury: PublicKey;
    oraoNetwork: PublicKey;
    oraoProgram: PublicKey;
    pda: PublicKey;
    whitelistMint?: PublicKey;
    whitelistAccount?: PublicKey;
    whitelistTokenProgram?: PublicKey;
    listing: PublicKey;
  }
): Promise<TransactionInstruction> {
  const data = Buffer.alloc(64);
  let offset = 0;
  
  // Write discriminator
  data.set(INSTRUCTION_DISCRIMINATORS.BUY_TICKETS, offset);
  offset += 8;
  
  // Write args
  data.writeUInt16LE(args.numTickets, offset);
  offset += 2;
  data.set(args.seed, offset);
  offset += 32;
  
  return new TransactionInstruction({
    keys: [
      { pubkey: accounts.user, isSigner: true, isWritable: true },
      { pubkey: accounts.userData, isSigner: false, isWritable: true },
      { pubkey: accounts.joinData, isSigner: false, isWritable: true },
      { pubkey: accounts.launchData, isSigner: false, isWritable: true },
      { pubkey: accounts.launchQuote, isSigner: false, isWritable: true },
      { pubkey: accounts.fees, isSigner: false, isWritable: true },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.oraoRandom, isSigner: false, isWritable: false },
      { pubkey: accounts.oraoTreasury, isSigner: false, isWritable: false },
      { pubkey: accounts.oraoNetwork, isSigner: false, isWritable: false },
      { pubkey: accounts.oraoProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.pda, isSigner: false, isWritable: false },
      { pubkey: accounts.whitelistMint || SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: accounts.whitelistAccount || SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: accounts.whitelistTokenProgram || SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: accounts.listing, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: data.slice(0, offset),
  });
}

// Claim tokens instruction
export async function createClaimTokensInstruction(
  accounts: {
    user: PublicKey;
    userData: PublicKey;
    joinData: PublicKey;
    launchData: PublicKey;
    launchQuote: PublicKey;
    tempWsol: PublicKey;
    quoteTokenMint: PublicKey;
    cookBaseToken: PublicKey;
    userBase: PublicKey;
    baseTokenMint: PublicKey;
    cookPda: PublicKey;
    listing: PublicKey;
    quoteTokenProgram: PublicKey;
    baseTokenProgram: PublicKey;
    associatedToken: PublicKey;
    systemProgram: PublicKey;
  }
): Promise<TransactionInstruction> {
  const data = Buffer.alloc(8);
  data.set(INSTRUCTION_DISCRIMINATORS.CLAIM_TOKENS, 0);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: accounts.user, isSigner: true, isWritable: true },
      { pubkey: accounts.userData, isSigner: false, isWritable: true },
      { pubkey: accounts.joinData, isSigner: false, isWritable: true },
      { pubkey: accounts.launchData, isSigner: false, isWritable: true },
      { pubkey: accounts.launchQuote, isSigner: false, isWritable: true },
      { pubkey: accounts.tempWsol, isSigner: false, isWritable: true },
      { pubkey: accounts.quoteTokenMint, isSigner: false, isWritable: true },
      { pubkey: accounts.cookBaseToken, isSigner: false, isWritable: true },
      { pubkey: accounts.userBase, isSigner: false, isWritable: true },
      { pubkey: accounts.baseTokenMint, isSigner: false, isWritable: true },
      { pubkey: accounts.cookPda, isSigner: false, isWritable: true },
      { pubkey: accounts.listing, isSigner: false, isWritable: false },
      { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.baseTokenProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.associatedToken, isSigner: false, isWritable: false },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Helper to get common account addresses
export async function getCommonAccounts(user: PublicKey) {
  const [cookPda] = await findProgramAddress([Buffer.from('cook')], PROGRAM_ID);
  const [cookData] = await findProgramAddress([Buffer.from('data')], PROGRAM_ID);
  
  return {
    cookPda,
    cookData,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    clock: SYSVAR_CLOCK_PUBKEY,
  };
}