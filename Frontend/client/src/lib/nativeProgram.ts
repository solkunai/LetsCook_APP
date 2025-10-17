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
import { serialize } from 'borsh';
import * as borsh from '@coral-xyz/borsh';

// Your deployed program ID
export const PROGRAM_ID = new PublicKey('ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ');

// Instruction enum matching your Rust program
export enum LaunchInstruction {
  Init = 0,
  CreateLaunch = 1,
  BuyTickets = 2,
  CheckTickets = 3,
  InitCookAMM = 4,
  HypeVote = 5,
  ClaimRefund = 6,
  EditLaunch = 7,
  ClaimTokens = 8,
  SetName = 9,
  SwapCookAMM = 10,
  GetMMRewardTokens = 11,
  CloseAccount = 12,
  LaunchCollection = 13,
  ClaimNFT = 14,
  MintNFT = 15,
  WrapNFT = 16,
  EditCollection = 17,
  MintRandomNFT = 18,
  CreateOpenBookMarket = 19,
  CreateRaydium = 20,
  SwapRaydium = 21,
  AddCookLiquidity = 22,
  RemoveCookLiquidity = 23,
  CreateUnverifiedListing = 24,
  CreateListing = 25,
  SwapRaydiumClassic = 26,
  InitCookAMMExternal = 27,
  CreateInstantLaunch = 28,
  AddTradeRewards = 29,
  ListNFT = 30,
  UnlistNFT = 31,
  BuyNFT = 32,
  UpdateRaffleImages = 33,
}

// Instruction argument interfaces matching your Rust structs
export interface CreateArgs {
  name: string;
  symbol: string;
  uri: string;
  icon: string;
  banner: string;
  total_supply: number;
  decimals: number;
  launch_date: number;
  close_date: number;
  num_mints: number;
  ticket_price: number;
  page_name: string;
  transfer_fee: number;
  max_transfer_fee: number;
  extensions: number;
  amm_provider: number;
  launch_type: number;
  whitelist_tokens: number;
  whitelist_end: number;
}

// InstantLaunchArgs interface matching Rust struct (for instant launches)
export interface InstantLaunchArgs {
  name: string;
  symbol: string;
  uri: string;
  icon: string;
  banner: string;
  total_supply: number;
  decimals: number;
  ticket_price: number;
  page_name: string;
  transfer_fee: number;
  max_transfer_fee: number;
  extensions: number;
  amm_provider: number;
  launch_type: number;
  whitelist_tokens: number;
  whitelist_end: number;
}

export interface BuyTicketsArgs {
  amount: number;
}

export interface HypeVoteArgs {
  vote: number;
}

export interface SetNameArgs {
  name: string;
}

export interface EditLaunchArgs {
  name: string;
  symbol: string;
  uri: string;
  icon: string;
  banner: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
}

export interface PlaceOrderArgs {
  side: number;
  limitPrice: number;
  maxBaseQuantity: number;
  maxQuoteQuantity: number;
  orderType: number;
  clientOrderId: number;
  limit: number;
}

export interface RaydiumSwapArgs {
  amountIn: number;
  minimumAmountOut: number;
}

export interface AddLiquidityArgs {
  amount0: number;
  amount1: number;
}

export interface RemoveLiquidityArgs {
  amount: number;
}

export interface ClaimNFTArgs {
  index: number;
}

export interface LaunchCollectionArgs {
  name: string;
  symbol: string;
  uri: string;
  icon: string;
  banner: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
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

export interface EditCollectionArgs {
  name: string;
  symbol: string;
  uri: string;
  icon: string;
  banner: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
}

export interface ListNFTArgs {
  price: number;
}

export interface UnlistNFTArgs {
  listingId: number;
}

export interface BuyNFTArgs {
  listingId: number;
}

export interface AddRewardsArgs {
  amount: number;
}

export interface InitAMMExternalArgs {
  amount0: number;
  amount1: number;
  openTime: number;
}

export interface CreateInstantLaunchArgs {
  name: string;
  symbol: string;
  uri: string;
  icon: string;
  banner: string;
  totalSupply: number;
  decimals: number;
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

export interface CreateUnverifiedListingArgs {
  name: string;
  symbol: string;
  icon: string;
  uri: string;
  banner: string;
  description: string;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
}

export interface CreateListingArgs {
  provider: number;
}

// Borsh schema for CreateArgs - using the standard borsh library
const createArgsSchema = {
  struct: {
    name: 'string',
    symbol: 'string',
    uri: 'string',
    icon: 'string',
    banner: 'string',
    total_supply: 'u64',
    decimals: 'u8',
    launch_date: 'u64',
    close_date: 'u64',
    num_mints: 'u32',
    ticket_price: 'u64',
    page_name: 'string',
    transfer_fee: 'u16',
    max_transfer_fee: 'u64',
    extensions: 'u8',
    amm_provider: 'u8',
    launch_type: 'u8',
    whitelist_tokens: 'u64',
    whitelist_end: 'u64',
  }
};

// Borsh schema for InstantLaunchArgs - using the standard borsh library
const instantLaunchArgsSchema = {
  struct: {
    name: 'string',
    symbol: 'string',
    uri: 'string',
    icon: 'string',
    banner: 'string',
    total_supply: 'u64',
    decimals: 'u8',
    ticket_price: 'u64',
    page_name: 'string',
    transfer_fee: 'u16',
    max_transfer_fee: 'u64',
    extensions: 'u8',
    amm_provider: 'u8',
    launch_type: 'u8',
    whitelist_tokens: 'u64',
    whitelist_end: 'u64',
  }
};

const updateRaffleImagesArgsSchema = {
  struct: {
    icon: 'string',
    banner: 'string',
  }
};

// Helper function to serialize instruction data
function serializeInstruction(instruction: LaunchInstruction, args?: any): Buffer {
  // For Borsh enum serialization, we need to serialize the enum variant index first
  // Then serialize the args if they exist
  
  const instructionIndex = Buffer.alloc(1);
  instructionIndex.writeUInt8(instruction, 0);
  
    if (args) {
      // Use the specific schema for CreateArgs (raffle launches)
      if (instruction === LaunchInstruction.CreateLaunch) {
        console.log('🔍 Serializing CreateArgs (raffle):', args);
        console.log('🔍 Args type check:', typeof args);
        console.log('🔍 Args keys:', Object.keys(args));
        try {
          const argsBuffer = Buffer.from(serialize(createArgsSchema, args));
          console.log('🔍 Serialized buffer length:', argsBuffer.length);
          console.log('🔍 Serialized buffer (first 50 bytes):', Array.from(argsBuffer.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          const finalBuffer = Buffer.concat([instructionIndex, argsBuffer]);
          console.log('🔍 Final instruction buffer length:', finalBuffer.length);
          return finalBuffer;
        } catch (error) {
          console.error('❌ Serialization error:', error);
          console.error('❌ Args that failed:', args);
          throw error;
        }
      } else if (instruction === LaunchInstruction.CreateInstantLaunch) {
        console.log('🔍 Serializing InstantLaunchArgs (instant):', args);
        console.log('🔍 Args type check:', typeof args);
        console.log('🔍 Args keys:', Object.keys(args));
        try {
          const argsBuffer = Buffer.from(serialize(instantLaunchArgsSchema, args));
          console.log('🔍 Serialized buffer length:', argsBuffer.length);
          console.log('🔍 Serialized buffer (first 50 bytes):', Array.from(argsBuffer.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          const finalBuffer = Buffer.concat([instructionIndex, argsBuffer]);
          console.log('🔍 Final instruction buffer length:', finalBuffer.length);
          return finalBuffer;
        } catch (error) {
          console.error('❌ Serialization error:', error);
          console.error('❌ Args that failed:', args);
          throw error;
        }
      } else if (instruction === LaunchInstruction.UpdateRaffleImages) {
        console.log('🔍 Serializing UpdateRaffleImages args:', args);
        try {
          const argsBuffer = Buffer.from(serialize(updateRaffleImagesArgsSchema, args));
          console.log('🔍 Serialized buffer length:', argsBuffer.length);
          const finalBuffer = Buffer.concat([instructionIndex, argsBuffer]);
          console.log('🔍 Final instruction buffer length:', finalBuffer.length);
          return finalBuffer;
        } catch (error) {
          console.error('❌ Serialization error:', error);
          console.error('❌ Args that failed:', args);
          throw error;
        }
      } else {
        // For other instructions, use generic serialize
        // For now, just return the instruction index for other instructions
        return instructionIndex;
      }
    }
  
  return instructionIndex;
}

// Instruction builders for your native Solana program
export class LetsCookProgram {
  
  // Initialize the program
  static createInitInstruction(
    user: PublicKey,
    cookData: PublicKey,
    cookPda: PublicKey,
    systemProgram: PublicKey = SystemProgram.programId
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.Init);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: cookData, isSigner: false, isWritable: true },
        { pubkey: cookPda, isSigner: false, isWritable: true },
        { pubkey: systemProgram, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });
  }

  // Create a raffle launch
  static createRaffleInstruction(
    args: CreateArgs,
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
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.CreateLaunch, args);
    
    const keys = [
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
    ];

    if (accounts.delegate) {
      keys.push({ pubkey: accounts.delegate, isSigner: false, isWritable: false });
    }

    if (accounts.hook) {
      keys.push({ pubkey: accounts.hook, isSigner: false, isWritable: false });
    }

    return new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  }

  // Create an instant launch
  static createInstantLaunchInstruction(
    args: InstantLaunchArgs,
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
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.CreateInstantLaunch, args);
    
    const keys = [
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
    ];

    if (accounts.delegate) {
      keys.push({ pubkey: accounts.delegate, isSigner: false, isWritable: false });
    }

    if (accounts.hook) {
      keys.push({ pubkey: accounts.hook, isSigner: false, isWritable: false });
    }

    return new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  }

  // Create a launch (legacy method - kept for backward compatibility)
  static createLaunchInstruction(
    args: CreateArgs,
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
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.CreateLaunch, args);
    
    const keys = [
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
    ];

    // Add optional accounts if provided
    if (accounts.delegate) {
      keys.push({ pubkey: accounts.delegate, isSigner: false, isWritable: false });
    }
    if (accounts.hook) {
      keys.push({ pubkey: accounts.hook, isSigner: false, isWritable: false });
    }
    
    return new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  }

  // Buy tickets for a launch
  static createBuyTicketsInstruction(
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
      oraoRandom?: PublicKey;
      oraoTreasury?: PublicKey;
      oraoNetwork?: PublicKey;
      oraoProgram?: PublicKey;
      pda?: PublicKey;
      whitelistMint?: PublicKey;
      whitelistAccount?: PublicKey;
      whitelistTokenProgram?: PublicKey;
      listing?: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.BuyTickets, args);
    
    const keys = [
      { pubkey: accounts.user, isSigner: true, isWritable: true },
      { pubkey: accounts.userData, isSigner: false, isWritable: true },
      { pubkey: accounts.joinData, isSigner: false, isWritable: true },
      { pubkey: accounts.launchData, isSigner: false, isWritable: true },
      { pubkey: accounts.launchQuote, isSigner: false, isWritable: true },
      { pubkey: accounts.fees, isSigner: false, isWritable: true },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false },
    ];

    // Add optional accounts
    if (accounts.oraoRandom) keys.push({ pubkey: accounts.oraoRandom, isSigner: false, isWritable: false });
    if (accounts.oraoTreasury) keys.push({ pubkey: accounts.oraoTreasury, isSigner: false, isWritable: false });
    if (accounts.oraoNetwork) keys.push({ pubkey: accounts.oraoNetwork, isSigner: false, isWritable: false });
    if (accounts.oraoProgram) keys.push({ pubkey: accounts.oraoProgram, isSigner: false, isWritable: false });
    if (accounts.pda) keys.push({ pubkey: accounts.pda, isSigner: false, isWritable: false });
    if (accounts.whitelistMint) keys.push({ pubkey: accounts.whitelistMint, isSigner: false, isWritable: false });
    if (accounts.whitelistAccount) keys.push({ pubkey: accounts.whitelistAccount, isSigner: false, isWritable: false });
    if (accounts.whitelistTokenProgram) keys.push({ pubkey: accounts.whitelistTokenProgram, isSigner: false, isWritable: false });
    if (accounts.listing) keys.push({ pubkey: accounts.listing, isSigner: false, isWritable: false });
    
    return new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  }

  // Check tickets
  static createCheckTicketsInstruction(
    accounts: {
      user: PublicKey;
      userData: PublicKey;
      joinData: PublicKey;
      launchData: PublicKey;
      oraoRandom?: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.CheckTickets);
    
    const keys = [
      { pubkey: accounts.user, isSigner: true, isWritable: true },
      { pubkey: accounts.userData, isSigner: false, isWritable: true },
      { pubkey: accounts.joinData, isSigner: false, isWritable: true },
      { pubkey: accounts.launchData, isSigner: false, isWritable: true },
    ];

    if (accounts.oraoRandom) {
      keys.push({ pubkey: accounts.oraoRandom, isSigner: false, isWritable: false });
    }
    
    keys.push({ pubkey: accounts.systemProgram, isSigner: false, isWritable: false });
    
    return new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  }

  // Initialize Cook AMM
  static createInitCookAMMInstruction(
    accounts: {
      user: PublicKey;
      userData: PublicKey;
      listing: PublicKey;
      launchData: PublicKey;
      teamToken: PublicKey;
      team: PublicKey;
      cookPda: PublicKey;
      amm: PublicKey;
      baseTokenMint: PublicKey;
      quoteTokenMint: PublicKey;
      lpTokenMint: PublicKey;
      cookBaseToken: PublicKey;
      cookQuoteToken: PublicKey;
      ammBase: PublicKey;
      ammQuote: PublicKey;
      tradeToEarn: PublicKey;
      priceData: PublicKey;
      quoteTokenProgram: PublicKey;
      baseTokenProgram: PublicKey;
      associatedToken: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.InitCookAMM);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },
        { pubkey: accounts.userData, isSigner: false, isWritable: true },
        { pubkey: accounts.listing, isSigner: false, isWritable: true },
        { pubkey: accounts.launchData, isSigner: false, isWritable: true },
        { pubkey: accounts.teamToken, isSigner: false, isWritable: true },
        { pubkey: accounts.team, isSigner: false, isWritable: true },
        { pubkey: accounts.cookPda, isSigner: false, isWritable: true },
        { pubkey: accounts.amm, isSigner: false, isWritable: true },
        { pubkey: accounts.baseTokenMint, isSigner: false, isWritable: true },
        { pubkey: accounts.quoteTokenMint, isSigner: false, isWritable: true },
        { pubkey: accounts.lpTokenMint, isSigner: false, isWritable: true },
        { pubkey: accounts.cookBaseToken, isSigner: false, isWritable: true },
        { pubkey: accounts.cookQuoteToken, isSigner: false, isWritable: true },
        { pubkey: accounts.ammBase, isSigner: false, isWritable: true },
        { pubkey: accounts.ammQuote, isSigner: false, isWritable: true },
        { pubkey: accounts.tradeToEarn, isSigner: false, isWritable: true },
        { pubkey: accounts.priceData, isSigner: false, isWritable: true },
        { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false },
        { pubkey: accounts.baseTokenProgram, isSigner: false, isWritable: false },
        { pubkey: accounts.associatedToken, isSigner: false, isWritable: false },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });
  }

  // Hype vote
  static createHypeVoteInstruction(
    args: HypeVoteArgs,
    accounts: {
      user: PublicKey;
      userData: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.HypeVote, args);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },
        { pubkey: accounts.userData, isSigner: false, isWritable: true },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });
  }

  // Set name
  static createSetNameInstruction(
    args: SetNameArgs,
    accounts: {
      user: PublicKey;
      userData: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.SetName, args);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },
        { pubkey: accounts.userData, isSigner: false, isWritable: true },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });
  }

  // Claim refund
  static createClaimRefundInstruction(
    accounts: {
      user: PublicKey;
      userData: PublicKey;
      joinData: PublicKey;
      launchData: PublicKey;
      launchQuote: PublicKey;
      tempWsol: PublicKey;
      quoteTokenMint: PublicKey;
      cookPda: PublicKey;
      quoteTokenProgram: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.ClaimRefund);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },
        { pubkey: accounts.userData, isSigner: false, isWritable: true },
        { pubkey: accounts.joinData, isSigner: false, isWritable: true },
        { pubkey: accounts.launchData, isSigner: false, isWritable: true },
        { pubkey: accounts.launchQuote, isSigner: false, isWritable: true },
        { pubkey: accounts.tempWsol, isSigner: false, isWritable: true },
        { pubkey: accounts.quoteTokenMint, isSigner: false, isWritable: true },
        { pubkey: accounts.cookPda, isSigner: false, isWritable: true },
        { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });
  }

  // Claim tokens
  static createClaimTokensInstruction(
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
      listing?: PublicKey;
      quoteTokenProgram: PublicKey;
      baseTokenProgram: PublicKey;
      associatedToken: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.ClaimTokens);
    
    const keys = [
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
    ];

    if (accounts.listing) {
      keys.push({ pubkey: accounts.listing, isSigner: false, isWritable: false });
    }
    
    keys.push(
      { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.baseTokenProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.associatedToken, isSigner: false, isWritable: false },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false }
    );
    
    return new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  }

  /**
   * Create instruction to update raffle images
   */
  static updateRaffleImagesInstruction(
    args: { icon: string; banner: string },
    accounts: {
      raffleAccount: PublicKey;
      authority: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    const instructionType = LaunchInstruction.UpdateRaffleImages;
    const argsBuffer = serializeInstruction(instructionType, args);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: accounts.raffleAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.authority, isSigner: true, isWritable: false },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: argsBuffer,
    });
  }
}

// Export the program ID for use in other files
export { PROGRAM_ID as LETS_COOK_PROGRAM_ID };