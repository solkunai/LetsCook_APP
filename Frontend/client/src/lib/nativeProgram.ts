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
export const PROGRAM_ID = new PublicKey('J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg');

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
  CreateAmmQuote = 29,
  CreateAmmBase = 30, // Helper instruction to create amm_base separately
  AddTradeRewards = 31,
  ListNFT = 32,
  UnlistNFT = 33,
  BuyNFT = 34,
  UpdateRaffleImages = 35,
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
  // Launch state fields (passed to avoid deserializing LaunchData in program)
  isInstantLaunch: number; // 0 = false, 1 = true
  isGraduated: number;       // 0 = false, 1 = true
  tokensSold: number;        // Current tokens sold for bonding curve
  totalSupply: number;       // Total supply for creator limit check
  creatorKey: string;        // Creator pubkey for limit check
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
    description: 'string',
    website: 'string',
    twitter: 'string',
    telegram: 'string',
    discord: 'string',
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
        
        // CRITICAL: Ensure total_supply is a proper integer and log it
        if (args && 'total_supply' in args) {
          const originalSupply = args.total_supply;
          const supplyType = typeof originalSupply;
          console.log('💰 Total supply before serialization:', {
            value: originalSupply,
            type: supplyType,
            isInteger: Number.isInteger(originalSupply),
            isSafeInteger: Number.isSafeInteger(originalSupply),
            stringValue: String(originalSupply),
          });
          
          // Ensure it's a safe integer
          if (!Number.isSafeInteger(originalSupply)) {
            console.error('❌ Total supply is not a safe integer!', originalSupply);
            // Try to convert from string or BigInt
            if (typeof originalSupply === 'string') {
              args.total_supply = parseInt(originalSupply, 10);
              console.log('✅ Converted from string:', args.total_supply);
            } else if (typeof originalSupply === 'bigint') {
              if (originalSupply > BigInt(Number.MAX_SAFE_INTEGER)) {
                throw new Error(`Total supply ${originalSupply} exceeds safe integer range`);
              }
              args.total_supply = Number(originalSupply);
              console.log('✅ Converted from BigInt:', args.total_supply);
            } else {
              throw new Error(`Invalid total_supply type: ${supplyType}, value: ${originalSupply}`);
            }
          }
          
          // Final validation
          if (!Number.isInteger(args.total_supply) || args.total_supply <= 0) {
            throw new Error(`Invalid total_supply: ${args.total_supply}`);
          }
          
          console.log('✅ Total supply validated:', args.total_supply);
        }
        
        try {
          const argsBuffer = Buffer.from(serialize(instantLaunchArgsSchema, args));
          console.log('🔍 Serialized buffer length:', argsBuffer.length);
          
          // Extract and verify total_supply from serialized buffer
          // total_supply is after: name, symbol, uri, icon, banner (all strings with 4-byte length prefix)
          // We need to find where total_supply starts (it's a u64 = 8 bytes)
          // For now, just log the buffer
          console.log('🔍 Serialized buffer (first 100 bytes):', Array.from(argsBuffer.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          
          const finalBuffer = Buffer.concat([instructionIndex, argsBuffer]);
          console.log('🔍 Final instruction buffer length:', finalBuffer.length);
          return finalBuffer;
        } catch (error) {
          console.error('❌ Serialization error:', error);
          console.error('❌ Args that failed:', args);
          console.error('❌ Total supply in failed args:', args?.total_supply);
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
    programData: PublicKey,
    systemProgram: PublicKey,
    cookData: PublicKey,
    cookPda: PublicKey
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.Init);
    
    // Backend expects 5 accounts in this order: user, program_data, system_program, cook_data, cook_pda
    return new TransactionInstruction({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },              // 0: user
        { pubkey: programData, isSigner: false, isWritable: true },      // 1: program_data
        { pubkey: systemProgram, isSigner: false, isWritable: false },   // 2: system_program
        { pubkey: cookData, isSigner: false, isWritable: true },         // 3: cook_data
        { pubkey: cookPda, isSigner: false, isWritable: true },          // 4: cook_pda
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
      team: PublicKey;
      baseTokenMint: PublicKey;
      quoteTokenMint: PublicKey;
      cookData: PublicKey;
      cookPda: PublicKey;
      launchQuote: PublicKey;
      cookBaseToken: PublicKey;
      systemProgram: PublicKey;
      tokenProgram: PublicKey;
      token2022Program: PublicKey;
      baseTokenProgram: PublicKey;
      quoteTokenProgram: PublicKey;
      associatedToken: PublicKey;
      whitelist?: PublicKey;
      delegate?: PublicKey;
      hook?: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.CreateLaunch, args);
    
    // Backend expects 19 accounts in this exact order:
    const keys = [
      { pubkey: accounts.user, isSigner: true, isWritable: true },              // 0: user
      { pubkey: accounts.listing, isSigner: false, isWritable: true },          // 1: listing
      { pubkey: accounts.launchData, isSigner: false, isWritable: true },       // 2: launch_data
      { pubkey: accounts.team, isSigner: false, isWritable: true },            // 3: team
      { pubkey: accounts.baseTokenMint, isSigner: false, isWritable: true },    // 4: base_token_mint
      { pubkey: accounts.quoteTokenMint, isSigner: false, isWritable: true },   // 5: quote_token_mint
      { pubkey: accounts.cookData, isSigner: false, isWritable: true },         // 6: cook_data
      { pubkey: accounts.cookPda, isSigner: false, isWritable: true },          // 7: cook_pda
      { pubkey: accounts.launchQuote, isSigner: false, isWritable: true },      // 8: launch_quote
      { pubkey: accounts.cookBaseToken, isSigner: false, isWritable: true },    // 9: cook_base_token
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },  // 10: system_program
      { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },   // 11: token_program
      { pubkey: accounts.token2022Program, isSigner: false, isWritable: false }, // 12: token_2022_program
      { pubkey: accounts.baseTokenProgram, isSigner: false, isWritable: false }, // 13: base_token_program
      { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false }, // 14: quote_token_program
      { pubkey: accounts.associatedToken, isSigner: false, isWritable: false }, // 15: associated_token
      { pubkey: accounts.whitelist || SystemProgram.programId, isSigner: false, isWritable: false }, // 16: whitelist
      { pubkey: accounts.delegate || SystemProgram.programId, isSigner: false, isWritable: false }, // 17: delegate
      { pubkey: accounts.hook || SystemProgram.programId, isSigner: false, isWritable: false },     // 18: hook
    ];

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
      baseTokenMint: PublicKey;
      quoteTokenMint: PublicKey;
      cookData: PublicKey;
      cookPda: PublicKey;
      amm: PublicKey;
      ammQuote: PublicKey;
      lpTokenMint: PublicKey;
      systemProgram: PublicKey;
      baseTokenProgram: PublicKey;
      quoteTokenProgram: PublicKey;
      priceData: PublicKey;
      associatedToken: PublicKey;
      cookBaseToken: PublicKey; // ATA for cook_pda to hold initial token supply
      ammBase: PublicKey;
      userData: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.CreateInstantLaunch, args);
    
    // Backend expects 18 accounts in this exact order:
    const keys = [
      { pubkey: accounts.user, isSigner: true, isWritable: true },              // 0: user
      { pubkey: accounts.listing, isSigner: false, isWritable: true },          // 1: listing
      { pubkey: accounts.launchData, isSigner: false, isWritable: true },       // 2: launch_data
      { pubkey: accounts.baseTokenMint, isSigner: false, isWritable: true },   // 3: base_token_mint
      { pubkey: accounts.quoteTokenMint, isSigner: false, isWritable: true },    // 4: quote_token_mint
      { pubkey: accounts.cookData, isSigner: false, isWritable: true },         // 5: cook_data
      { pubkey: accounts.cookPda, isSigner: false, isWritable: true },          // 6: cook_pda
      { pubkey: accounts.amm, isSigner: false, isWritable: true },             // 7: amm
      { pubkey: accounts.ammQuote, isSigner: true, isWritable: true },        // 8: amm_quote (signer for Alternative 4)
      { pubkey: accounts.lpTokenMint, isSigner: false, isWritable: true },     // 9: lp_token_mint
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },  // 10: system_program
      { pubkey: accounts.baseTokenProgram, isSigner: false, isWritable: false }, // 11: base_token_program
      { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false }, // 12: quote_token_program
      { pubkey: accounts.priceData, isSigner: false, isWritable: true },         // 13: price_data
      { pubkey: accounts.associatedToken, isSigner: false, isWritable: false }, // 14: associated_token
      { pubkey: accounts.cookBaseToken, isSigner: false, isWritable: true },  // 15: cook_base_token (ATA for cook_pda)
      { pubkey: accounts.ammBase, isSigner: false, isWritable: true },        // 16: amm_base (PDA - signed by backend with PDA seeds)
      { pubkey: accounts.userData, isSigner: false, isWritable: true },         // 17: user_data
    ];

    return new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data,
    });
  }

  // Create AMM quote token account (helper instruction)
  static createAmmQuoteInstruction(
    accounts: {
      user: PublicKey;
      amm: PublicKey;
      ammQuote: PublicKey;
      quoteTokenMint: PublicKey;
      quoteTokenProgram: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    const data = serializeInstruction(LaunchInstruction.CreateAmmQuote);
    
    // Backend expects 5 accounts in main list, then amm_quote in remaining_accounts:
    const keys = [
      { pubkey: accounts.user, isSigner: true, isWritable: true },              // 0: user
      { pubkey: accounts.amm, isSigner: false, isWritable: false },             // 1: amm
      { pubkey: accounts.quoteTokenMint, isSigner: false, isWritable: false },   // 2: quote_token_mint
      { pubkey: accounts.quoteTokenProgram, isSigner: false, isWritable: false }, // 3: quote_token_program
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },    // 4: system_program
      { pubkey: accounts.ammQuote, isSigner: false, isWritable: true },        // 5: amm_quote (remaining_accounts)
    ];

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

  /**
   * Create Raydium pool instruction
   * Creates a Raydium liquidity pool with specified amounts
   */
  static createRaydiumPoolInstruction(
    args: { amount_0: number; amount_1: number },
    accounts: {
      user: PublicKey;
      tokenMintA: PublicKey;
      tokenMintB: PublicKey;
      poolState: PublicKey;
      poolAuthority: PublicKey;
      poolTokenVaultA: PublicKey;
      poolTokenVaultB: PublicKey;
      lpMint: PublicKey;
      tokenProgram: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    // Serialize CreateRaydiumArgs: { amount_0: u64, amount_1: u64 }
    const argsBuffer = Buffer.alloc(16); // 8 + 8 bytes
    argsBuffer.writeBigUInt64LE(BigInt(args.amount_0), 0);
    argsBuffer.writeBigUInt64LE(BigInt(args.amount_1), 8);
    
    // Serialize instruction: variant index (1 byte) + args (16 bytes)
    const instructionIndex = Buffer.alloc(1);
    instructionIndex.writeUInt8(LaunchInstruction.CreateRaydium, 0);
    const data = Buffer.concat([instructionIndex, argsBuffer]);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },              // 0: user
        { pubkey: accounts.tokenMintA, isSigner: false, isWritable: false },      // 1: token_mint_a
        { pubkey: accounts.tokenMintB, isSigner: false, isWritable: false },      // 2: token_mint_b
        { pubkey: accounts.poolState, isSigner: false, isWritable: true },         // 3: pool_state
        { pubkey: accounts.poolAuthority, isSigner: false, isWritable: false },    // 4: pool_authority
        { pubkey: accounts.poolTokenVaultA, isSigner: false, isWritable: true },   // 5: pool_token_vault_a
        { pubkey: accounts.poolTokenVaultB, isSigner: false, isWritable: true },   // 6: pool_token_vault_b
        { pubkey: accounts.lpMint, isSigner: false, isWritable: true },           // 7: lp_mint
        { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },    // 8: token_program
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },   // 9: system_program
      ],
      programId: PROGRAM_ID,
      data,
    });
  }

  /**
   * Create amm_base token account instruction
   * Helper instruction to create amm_base separately (useful for fixing launches)
   */
  static createAmmBaseInstruction(
    accounts: {
      user: PublicKey;
      ammBase: PublicKey;
      amm: PublicKey;
      baseTokenMint: PublicKey;
      baseTokenProgram: PublicKey;
      systemProgram: PublicKey;
    }
  ): TransactionInstruction {
    // Serialize instruction: variant index (1 byte) only, no args
    const instructionIndex = Buffer.alloc(1);
    instructionIndex.writeUInt8(LaunchInstruction.CreateAmmBase, 0);
    
    return new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },              // 0: user
        { pubkey: accounts.ammBase, isSigner: true, isWritable: true },           // 1: amm_base (signer for keypair)
        { pubkey: accounts.amm, isSigner: false, isWritable: false },             // 2: amm
        { pubkey: accounts.baseTokenMint, isSigner: false, isWritable: false },   // 3: base_token_mint
        { pubkey: accounts.baseTokenProgram, isSigner: false, isWritable: false }, // 4: base_token_program
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },   // 5: system_program
      ],
      programId: PROGRAM_ID,
      data: instructionIndex,
    });
  }
}

// Export the program ID for use in other files
export { PROGRAM_ID as LETS_COOK_PROGRAM_ID };