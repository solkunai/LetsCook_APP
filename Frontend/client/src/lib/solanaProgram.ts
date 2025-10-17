import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { useWalletConnection } from '@/lib/wallet';
import * as borsh from 'borsh';

// Program ID from our deployed program - HARDCODED FOR TESTING
export const PROGRAM_ID = new PublicKey("ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ");

// Helper function to generate real instruction discriminators
// Using Web Crypto API to generate actual SHA256 hashes
async function getDiscriminator(name: string): Promise<Buffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode("global:" + name);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hashBuffer).slice(0, 8);
}

// Shank Instruction Discriminators (SHA256 first 8 bytes) - CORRECT VALUES
export const INSTRUCTION_DISCRIMINATORS = {
  INIT: [52, 178, 145, 198, 120, 56, 133, 118], // 34b291c678388576
  CREATELAUNCH: [130, 182, 78, 139, 208, 228, 109, 210], // 82b64e8bd0e46dd2
  BUYTICKETS: [140, 41, 103, 234, 32, 215, 19, 81], // 8c2967ea20d71351
  CHECKTICKETS: [168, 83, 222, 23, 43, 17, 226, 37], // a853de172b11e225
  INITCOOKAMM: [126, 110, 254, 17, 141, 68, 245, 55], // 7e6efe118d44f537
  HYPEVOTE: [177, 247, 119, 101, 126, 183, 98, 197], // b1f777657eb762c5
  CLAIMREFUND: [209, 184, 36, 255, 202, 174, 232, 175], // d1b824ffcaaee8af
  EDITLAUNCH: [149, 86, 179, 221, 222, 169, 227, 243], // 9556b3dddea9e3f3
  CLAIMTOKENS: [118, 169, 117, 161, 219, 8, 61, 51], // 76a975a1db083d33
  SETNAME: [3, 36, 178, 99, 80, 113, 27, 136], // 0324b26350711b88
  SWAPCOOKAMM: [98, 66, 240, 119, 90, 85, 147, 11], // 6242f0775a55930b
  GETMMREWARDTOKENS: [115, 223, 181, 226, 71, 253, 232, 42], // 73dfb5e247fde82a
  CLOSEACCOUNT: [88, 24, 123, 10, 115, 62, 150, 150], // 58187b0a733e9696
  LAUNCHCOLLECTION: [251, 8, 236, 185, 225, 68, 190, 223], // fb08ecb9e144bedf
  CLAIMNFT: [228, 27, 144, 186, 35, 205, 233, 29], // e41b90ba23cde91d
  MINTNFT: [146, 252, 205, 182, 114, 241, 193, 41], // 92fccdb672f1c129
  WRAPNFT: [43, 177, 11, 139, 69, 37, 33, 244], // 2bb10b8b452521f4
  EDITCOLLECTION: [137, 224, 58, 103, 103, 79, 206, 190], // 89e03a67674fcebe
  MINTRANDOMNFT: [42, 74, 146, 96, 240, 99, 128, 108], // 2a4a9260f063806c
  CREATEOPENBOOKMARKET: [170, 231, 18, 123, 4, 15, 124, 14], // aae7127b040f7c0e
  CREATERAYDIUM: [36, 61, 114, 79, 216, 167, 240, 107], // 243d724fd8a7f06b
  SWAPRAYDIUM: [42, 10, 245, 7, 39, 116, 139, 31], // 2a0af50727748b1f
  ADDCOOKLIQUIDITY: [213, 126, 253, 226, 95, 138, 110, 34], // d57efde25f8a6e22
  REMOVECOOKLIQUIDITY: [247, 12, 109, 221, 88, 14, 137, 227], // f70c6ddd580e89e3
  CREATEUNVERIFIEDLISTING: [24, 101, 44, 163, 20, 135, 230, 164], // 18652ca31487e6a4
  CREATELISTING: [144, 249, 41, 54, 90, 22, 180, 30], // 90f929365a16b41e
  SWAPRAYDIUMCLASSIC: [40, 136, 107, 114, 255, 169, 183, 58], // 28886b72ffa9b73a
  INITCOOKAMMEXTERNAL: [73, 157, 241, 202, 135, 220, 89, 60], // 499df1ca87dc593c
  CREATEINSTANTLAUNCH: [60, 38, 243, 155, 220, 34, 15, 205], // 3c26f39bdc220fcd
  ADDTRADEREWARDS: [49, 98, 141, 2, 76, 190, 60, 135], // 31628d024cbe3c87
  LISTNFT: [168, 64, 204, 29, 233, 28, 131, 59], // a840cc1de91c833b
  UNLISTNFT: [144, 201, 218, 26, 63, 161, 18, 198], // 90c9da1a3fa112c6
  BUYNFT: [223, 24, 85, 189, 65, 173, 152, 235], // df1855bd41ad98eb
};

// Raw instruction builder with correct discriminators
function buildRawInstruction(
  instructionName: keyof typeof INSTRUCTION_DISCRIMINATORS,
  args: Buffer,
  keys: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>,
  programId: PublicKey
): TransactionInstruction {
  const discriminator = INSTRUCTION_DISCRIMINATORS[instructionName];
  const discriminatorBuffer = Buffer.from(discriminator);
  
  // Compose raw instruction data: discriminator + args
  const instructionData = Buffer.concat([discriminatorBuffer, args]);
  
  console.log(`🔧 Raw instruction ${instructionName}:`, {
    discriminator: Array.from(discriminator).map(b => b.toString(16).padStart(2, '0')).join(''),
    argsLength: args.length,
    totalDataLength: instructionData.length,
    accountCount: keys.length
  });
  
  return new TransactionInstruction({
    keys,
    programId,
    data: instructionData,
  });
}

// Borsh schemas for serialization/deserialization
// Based on actual Rust struct definitions from Backend/program/src/launch/state.rs

// AccountType enum (u8)
enum AccountType {
  Launch = 0,
  Program = 1,
  User = 2,
  Join = 3,
  MMUserData = 4,
  MMLaunchData = 5,
  AMM = 6,
  TimeSeries = 7,
  CollectionLaunch = 8,
  NFTAssignment = 9,
  NFTLookup = 10,
  Listing = 11,
  UnverifiedListing = 12,
}

// LaunchMetaType enum (u8)
enum LaunchMetaType {
  Raffle = 0,
  FCFS = 1,
  IDO = 2,
}

// LaunchPluginType enum (u8)
enum LaunchPluginType {
  WhiteListToken = 0,
}

// TicketStatus enum (u8)
enum TicketStatus {
  Available = 0,
  LosingRefunded = 1,
  WinningClaimed = 2,
  FullyRefunded = 3,
}

// Classes matching Rust structs exactly
class WhiteListTokenClass {
  key: PublicKey = PublicKey.default;
  quantity: bigint = BigInt(0);
  phase_end: bigint = BigInt(0);
}

class LaunchPluginClass {
  // This is an enum in Rust: LaunchPlugin::WhiteListToken(WhiteListToken)
  // We'll represent it as a discriminated union
  type: LaunchPluginType = LaunchPluginType.WhiteListToken;
  data: WhiteListTokenClass = new WhiteListTokenClass();
}

class RaffleClass {
  // Empty struct in Rust
}

class FCFSClass {
  // Empty struct in Rust
}

class IDOClass {
  token_fraction_distributed: number = 0.0; // f64
  tokens_distributed: bigint = BigInt(0);
}

class LaunchMetaClass {
  // This is an enum in Rust: LaunchMeta::Raffle(Raffle) | FCFS(FCFS) | IDO(IDO)
  // Rust enums serialize as: [discriminator: u8][variant_data]
  type: LaunchMetaType = LaunchMetaType.Raffle;
  data: RaffleClass | FCFSClass | IDOClass = new RaffleClass();
  
  // Serialize as Rust enum
  serialize(): Buffer {
    const buffer = Buffer.alloc(100); // Allocate enough space
    let offset = 0;
    
    // Write discriminator byte (0=Raffle, 1=FCFS, 2=IDO)
    buffer.writeUInt8(this.type, offset);
    offset += 1;
    
    // Serialize variant data based on type
    switch (this.type) {
      case LaunchMetaType.Raffle:
        // Raffle is empty struct, no additional data
        break;
      case LaunchMetaType.FCFS:
        // FCFS is empty struct, no additional data
        break;
      case LaunchMetaType.IDO:
        // IDO has token_fraction_distributed: f64, tokens_distributed: u64
        const idoData = this.data as IDOClass;
        buffer.writeDoubleLE(idoData.token_fraction_distributed, offset);
        offset += 8;
        buffer.writeBigUInt64LE(idoData.tokens_distributed, offset);
        offset += 8;
        break;
    }
    
    return buffer.slice(0, offset);
  }
}

class LaunchDataClass {
  account_type: AccountType = AccountType.Launch;
  launch_meta: LaunchMetaClass = new LaunchMetaClass();
  plugins: LaunchPluginClass[] = [];
  last_interaction: bigint = BigInt(0); // i64
  num_interactions: number = 0; // u16
  page_name: string = '';
  listing: PublicKey = PublicKey.default;
  total_supply: bigint = BigInt(0); // u64
  num_mints: number = 0; // u32
  ticket_price: bigint = BigInt(0); // u64
  minimum_liquidity: bigint = BigInt(0); // u64
  launch_date: bigint = BigInt(0); // u64
  end_date: bigint = BigInt(0); // u64
  tickets_sold: number = 0; // u32
  ticket_claimed: number = 0; // u32
  mints_won: number = 0; // u32
  buffer1: bigint = BigInt(0); // u64
  buffer2: bigint = BigInt(0); // u64
  buffer3: number = 0; // u32
  distribution: number[] = []; // Vec<u8>
  flags: number[] = []; // Vec<u8>
  strings: string[] = []; // Vec<String>
  keys: PublicKey[] = []; // Vec<Pubkey>
}

class JoinDataClass {
  account_type: AccountType = AccountType.Join;
  joiner_key: PublicKey = PublicKey.default;
  page_name: string = '';
  num_tickets: number = 0; // u16
  num_tickets_checked: number = 0; // u16
  num_winning_tickets: number = 0; // u16
  ticket_status: TicketStatus = TicketStatus.Available;
  random_address: PublicKey = PublicKey.default;
  last_slot: bigint = BigInt(0); // u64
}

class ListingClass {
  account_type: AccountType = AccountType.Listing;
  id: bigint = BigInt(0); // u64
  mint: PublicKey = PublicKey.default;
  name: string = '';
  symbol: string = '';
  decimals: number = 0; // u8
  icon_url: string = '';
  meta_url: string = '';
  banner_url: string = '';
  description: string = '';
  positive_votes: number = 0; // u32
  negative_votes: number = 0; // u32
}

// Manual deserialization functions for Rust structs
// Since Borsh enum serialization is complex, we'll handle it manually

function deserializeLaunchData(data: Buffer): LaunchDataClass {
  const launchData = new LaunchDataClass();
  let offset = 0;
  
  // account_type: AccountType (u8)
  launchData.account_type = data.readUInt8(offset);
  offset += 1;
  
  // launch_meta: LaunchMeta (enum with discriminator)
  // First byte is the enum discriminator
  const metaType = data.readUInt8(offset);
  offset += 1;
  
  launchData.launch_meta.type = metaType;
  switch (metaType) {
    case LaunchMetaType.Raffle:
      launchData.launch_meta.data = new RaffleClass();
      break;
    case LaunchMetaType.FCFS:
      launchData.launch_meta.data = new FCFSClass();
      break;
    case LaunchMetaType.IDO:
      const ido = new IDOClass();
      ido.token_fraction_distributed = data.readDoubleLE(offset);
      offset += 8;
      ido.tokens_distributed = data.readBigUInt64LE(offset);
      offset += 8;
      launchData.launch_meta.data = ido;
      break;
  }
  
  // plugins: Vec<LaunchPlugin>
  const pluginsLength = data.readUInt32LE(offset);
  offset += 4;
  launchData.plugins = [];
  for (let i = 0; i < pluginsLength; i++) {
    const plugin = new LaunchPluginClass();
    plugin.type = data.readUInt8(offset);
    offset += 1;
    
    if (plugin.type === LaunchPluginType.WhiteListToken) {
      const whitelistToken = new WhiteListTokenClass();
      // Read PublicKey (32 bytes)
      whitelistToken.key = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      whitelistToken.quantity = data.readBigUInt64LE(offset);
      offset += 8;
      whitelistToken.phase_end = data.readBigUInt64LE(offset);
      offset += 8;
      plugin.data = whitelistToken;
    }
    launchData.plugins.push(plugin);
  }
  
  // last_interaction: i64
  launchData.last_interaction = data.readBigInt64LE(offset);
  offset += 8;
  
  // num_interactions: u16
  launchData.num_interactions = data.readUInt16LE(offset);
  offset += 2;
  
  // page_name: String
  const pageNameLength = data.readUInt32LE(offset);
  offset += 4;
  launchData.page_name = data.slice(offset, offset + pageNameLength).toString('utf8');
  offset += pageNameLength;
  
  // listing: Pubkey
  launchData.listing = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  // total_supply: u64
  launchData.total_supply = data.readBigUInt64LE(offset);
  offset += 8;
  
  // num_mints: u32
  launchData.num_mints = data.readUInt32LE(offset);
  offset += 4;
  
  // ticket_price: u64
  launchData.ticket_price = data.readBigUInt64LE(offset);
  offset += 8;
  
  // minimum_liquidity: u64
  launchData.minimum_liquidity = data.readBigUInt64LE(offset);
  offset += 8;
  
  // launch_date: u64
  launchData.launch_date = data.readBigUInt64LE(offset);
  offset += 8;
  
  // end_date: u64
  launchData.end_date = data.readBigUInt64LE(offset);
  offset += 8;
  
  // tickets_sold: u32
  launchData.tickets_sold = data.readUInt32LE(offset);
  offset += 4;
  
  // ticket_claimed: u32
  launchData.ticket_claimed = data.readUInt32LE(offset);
  offset += 4;
  
  // mints_won: u32
  launchData.mints_won = data.readUInt32LE(offset);
  offset += 4;
  
  // buffer1: u64
  launchData.buffer1 = data.readBigUInt64LE(offset);
  offset += 8;
  
  // buffer2: u64
  launchData.buffer2 = data.readBigUInt64LE(offset);
  offset += 8;
  
  // buffer3: u32
  launchData.buffer3 = data.readUInt32LE(offset);
  offset += 4;
  
  // distribution: Vec<u8>
  const distributionLength = data.readUInt32LE(offset);
  offset += 4;
  launchData.distribution = Array.from(data.slice(offset, offset + distributionLength));
  offset += distributionLength;
  
  // flags: Vec<u8>
  const flagsLength = data.readUInt32LE(offset);
  offset += 4;
  launchData.flags = Array.from(data.slice(offset, offset + flagsLength));
  offset += flagsLength;
  
  // strings: Vec<String>
  const stringsLength = data.readUInt32LE(offset);
  offset += 4;
  launchData.strings = [];
  for (let i = 0; i < stringsLength; i++) {
    const stringLength = data.readUInt32LE(offset);
    offset += 4;
    const stringValue = data.slice(offset, offset + stringLength).toString('utf8');
    offset += stringLength;
    launchData.strings.push(stringValue);
  }
  
  // keys: Vec<Pubkey>
  const keysLength = data.readUInt32LE(offset);
  offset += 4;
  launchData.keys = [];
  for (let i = 0; i < keysLength; i++) {
    const pubkey = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    launchData.keys.push(pubkey);
  }
  
  return launchData;
}

function deserializeJoinData(data: Buffer): JoinDataClass {
  const joinData = new JoinDataClass();
  let offset = 0;
  
  // account_type: AccountType (u8)
  joinData.account_type = data.readUInt8(offset);
  offset += 1;
  
  // joiner_key: Pubkey
  joinData.joiner_key = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  // page_name: String
  const pageNameLength = data.readUInt32LE(offset);
  offset += 4;
  joinData.page_name = data.slice(offset, offset + pageNameLength).toString('utf8');
  offset += pageNameLength;
  
  // num_tickets: u16
  joinData.num_tickets = data.readUInt16LE(offset);
  offset += 2;
  
  // num_tickets_checked: u16
  joinData.num_tickets_checked = data.readUInt16LE(offset);
  offset += 2;
  
  // num_winning_tickets: u16
  joinData.num_winning_tickets = data.readUInt16LE(offset);
  offset += 2;
  
  // ticket_status: TicketStatus (u8)
  joinData.ticket_status = data.readUInt8(offset);
  offset += 1;
  
  // random_address: Pubkey
  joinData.random_address = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  // last_slot: u64
  joinData.last_slot = data.readBigUInt64LE(offset);
  offset += 8;
  
  return joinData;
}

// Borsh schemas
const LAUNCH_META_SCHEMA = new Map([
  [LaunchMetaClass, {
    kind: 'struct',
    fields: [
      ['name', 'string'],
      ['symbol', 'string'],
      ['uri', 'string'],
      ['icon', 'string'],
      ['banner', 'string'],
      ['description', 'string'],
      ['website', 'string'],
      ['twitter', 'string'],
      ['telegram', 'string'],
      ['discord', 'string'],
    ]
  }]
]);

const LAUNCH_PLUGIN_SCHEMA = new Map([
  [LaunchPluginClass, {
    kind: 'struct',
    fields: [
      ['plugin_type', 'u32'],
      ['data', ['u8']],
    ]
  }]
]);

const LAUNCH_DATA_SCHEMA = new Map([
  [LaunchDataClass, {
    kind: 'struct',
    fields: [
      ['account_type', 'u8'],
      ['launch_meta', LaunchMetaClass],
      ['plugins', [LaunchPluginClass]],
      ['last_interaction', 'u64'],
      ['num_interactions', 'u32'],
      ['page_name', 'string'],
      ['listing', 'pubkey'],
      ['total_supply', 'u64'],
      ['num_mints', 'u32'],
      ['ticket_price', 'u64'],
      ['minimum_liquidity', 'u64'],
      ['launch_date', 'u64'],
      ['end_date', 'u64'],
      ['tickets_sold', 'u32'],
      ['ticket_claimed', 'u32'],
      ['mints_won', 'u32'],
      ['distribution', ['u32']],
      ['flags', ['u32']],
      ['strings', ['string']],
      ['keys', ['pubkey']],
    ]
  }]
]);

const LISTING_SCHEMA = new Map([
  [ListingClass, {
    kind: 'struct',
    fields: [
      ['account_type', 'u8'],
      ['id', 'u32'],
      ['mint', 'pubkey'],
      ['name', 'string'],
      ['symbol', 'string'],
      ['decimals', 'u8'],
      ['icon_url', 'string'],
      ['meta_url', 'string'],
      ['banner_url', 'string'],
      ['description', 'string'],
      ['positive_votes', 'u32'],
      ['negative_votes', 'u32'],
      ['socials', ['string']],
    ]
  }]
]);

const JOIN_DATA_SCHEMA = new Map([
  [JoinDataClass, {
    kind: 'struct',
    fields: [
      ['account_type', 'u8'],
      ['joiner_key', 'pubkey'],
      ['page_name', 'string'],
      ['num_tickets', 'u32'],
      ['num_tickets_checked', 'u32'],
      ['num_winning_tickets', 'u32'],
      ['ticket_status', 'u8'],
      ['random_address', 'pubkey'],
      ['last_slot', 'u64'],
    ]
  }]
]);

// Instruction schemas
const CREATE_LAUNCH_ARGS_SCHEMA = new Map([
  ['CreateLaunchArgs', {
    kind: 'struct',
    fields: [
      ['name', 'string'],
      ['symbol', 'string'],
      ['uri', 'string'],
      ['icon', 'string'],
      ['banner', 'string'],
      ['total_supply', 'u64'],
      ['decimals', 'u8'],
      ['launch_date', 'u64'],
      ['close_date', 'u64'],
      ['num_mints', 'u32'],
      ['ticket_price', 'u64'],
      ['page_name', 'string'],
      ['transfer_fee', 'u32'],
      ['max_transfer_fee', 'u32'],
      ['extensions', 'u32'],
      ['amm_provider', 'u8'],
      ['launch_type', 'u8'],
      ['whitelist_tokens', 'u32'],
      ['whitelist_end', 'u64'],
    ]
  }]
]);

const JOIN_ARGS_SCHEMA = new Map([
  ['JoinArgs', {
    kind: 'struct',
    fields: [
      ['num_tickets', 'u32'],
      ['seed', ['u8']],
    ]
  }]
]);

// Network configuration - HARDCODED API KEY FOR TESTING
// Get Helius API key from environment variables
const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY || '90f9fe0f-400f-4368-bc82-26d2a91b1da6'; // Fallback for testing
const HELIUS_NETWORK = 'devnet';

export const NETWORK = {
  devnet: `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
  devnet_fallback: 'https://api.devnet.solana.com', // Fallback to public devnet
  mainnet: `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
  localhost: 'http://localhost:8899',
} as const;

// Default connection - use Helius RPC if available, otherwise fallback to public devnet
export const connection = new Connection(NETWORK.devnet, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// Types matching your Rust program
export interface LaunchData {
  account_type: number;
  launch_meta: LaunchMeta;
  plugins: LaunchPlugin[];
  last_interaction: number;
  num_interactions: number;
  page_name: string;
  listing: PublicKey;
  total_supply: number;
  num_mints: number;
  ticket_price: number;
  minimum_liquidity: number;
  launch_date: number;
  end_date: number;
  tickets_sold: number;
  ticket_claimed: number;
  mints_won: number;
  distribution: number[];
  flags: number[];
  strings: string[];
  keys: PublicKey[];
}

export interface LaunchMeta {
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

export interface LaunchPlugin {
  plugin_type: number;
  data: number[];
}

export interface Listing {
  account_type: number;
  id: number;
  mint: PublicKey;
  name: string;
  symbol: string;
  decimals: number;
  icon_url: string;
  meta_url: string;
  banner_url: string;
  description: string;
  positive_votes: number;
  negative_votes: number;
  socials: string[];
}

export interface JoinData {
  account_type: number;
  joiner_key: PublicKey;
  page_name: string;
  num_tickets: number;
  num_tickets_checked: number;
  num_winning_tickets: number;
  ticket_status: number;
  random_address: PublicKey;
  last_slot: number;
}

export interface AMMData {
  account_type: number;
  pool: PublicKey;
  amm_provider: number;
  base_mint: PublicKey;
  quote_mint: PublicKey;
  lp_mint: PublicKey;
  base_key: PublicKey;
  quote_key: PublicKey;
  fee: number;
  num_data_accounts: number;
  last_price: number;
  lp_amount: number;
  borrow_cost: number;
  leverage_frac: number;
  amm_base_amount: number;
  amm_quote_amount: number;
  short_base_amount: number;
  long_quote_amount: number;
  start_time: number;
  plugins: AMMPlugin[];
}

export interface AMMPlugin {
  plugin_type: number;
  data: number[];
}

// Helper functions to derive PDAs
export function getLaunchDataPDA(pageName: string, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(pageName), Buffer.from('Launch')],
    programId
  );
}

export function getListingPDA(mint: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [mint.toBuffer(), Buffer.from('Listing')],
    programId
  );
}

export function getJoinDataPDA(user: PublicKey, pageName: string, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from(pageName), Buffer.from('Join')],
    programId
  );
}

export function getAMMPDA(baseMint: PublicKey, quoteMint: PublicKey, programId: PublicKey): [PublicKey, number] {
  const baseFirst = baseMint.toString() < quoteMint.toString();
  const seeds = baseFirst 
    ? [baseMint.toBuffer(), quoteMint.toBuffer(), Buffer.from('CookAMM')]
    : [quoteMint.toBuffer(), baseMint.toBuffer(), Buffer.from('CookAMM')];
  
  return PublicKey.findProgramAddressSync(seeds, programId);
}

export function getUserDataPDA(user: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from('UserData')],
    programId
  );
}

// API functions to fetch data from blockchain
export async function fetchAllLaunches(): Promise<LaunchDataClass[]> {
  try {
    const programAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0, // account_type is at offset 0
            bytes: Buffer.from([0]).toString('base64'), // Launch account type
          },
        },
      ],
    });

    const launches: LaunchDataClass[] = [];
    
    for (const { pubkey, account } of programAccounts) {
      try {
        // Parse the account data using manual deserialization
        const data = account.data;
        
        // Skip if not enough data
        if (data.length < 100) continue;
        
        // Deserialize using our custom function
        const launchData = deserializeLaunchData(data);
        launches.push(launchData);
      } catch (error) {
        console.error(`Error parsing launch data for ${pubkey.toString()}:`, error);
      }
    }
    
    return launches;
  } catch (error) {
    console.error('Error fetching launches:', error);
    return [];
  }
}

export async function fetchLaunchByPageName(pageName: string): Promise<LaunchDataClass | null> {
  try {
    const [launchPDA] = getLaunchDataPDA(pageName, PROGRAM_ID);
    const accountInfo = await connection.getAccountInfo(launchPDA);
    
    if (!accountInfo) return null;
    
    // Parse account data using manual deserialization
    const launchData = deserializeLaunchData(accountInfo.data);
    return launchData;
  } catch (error) {
    console.error('Error fetching launch:', error);
    return null;
  }
}

export async function fetchUserTickets(user: PublicKey): Promise<JoinDataClass[]> {
  try {
    const programAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from([3]).toString('base64'), // Join account type
          },
        },
        {
          memcmp: {
            offset: 1, // joiner_key is at offset 1
            bytes: user.toBase58(),
          },
        },
      ],
    });

    const tickets: JoinDataClass[] = [];
    
    for (const { account } of programAccounts) {
      try {
        // Parse JoinData from account using manual deserialization
        const joinData = deserializeJoinData(account.data);
        tickets.push(joinData);
      } catch (error) {
        console.error('Error parsing ticket data:', error);
      }
    }
    
    return tickets;
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    return [];
  }
}

export async function fetchAMMData(baseMint: PublicKey, quoteMint: PublicKey): Promise<AMMData | null> {
  try {
    const [ammPDA] = getAMMPDA(baseMint, quoteMint, PROGRAM_ID);
    const accountInfo = await connection.getAccountInfo(ammPDA);
    
    if (!accountInfo) {
      console.log('AMM account not found:', ammPDA.toBase58());
      return null;
    }
    
    console.log('🔍 Fetching AMM data from:', ammPDA.toBase58());
    console.log('📊 Account data length:', accountInfo.data.length);
    
    // Deserialize AMM data using manual parsing (more reliable than Borsh for complex structs)
    try {
      const data = accountInfo.data;
      let offset = 0;
      
      // Parse AMM data manually based on Rust struct layout
      const accountType = data.readUInt8(offset);
      offset += 1;
      
      // Skip pool (32 bytes)
      const pool = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      const ammProvider = data.readUInt8(offset);
      offset += 1;
      
      // Skip base_mint (32 bytes)
      const baseMint = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      // Skip quote_mint (32 bytes)
      const quoteMint = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      // Skip lp_mint (32 bytes)
      const lpMint = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      // Skip base_key (32 bytes)
      const baseKey = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      // Skip quote_key (32 bytes)
      const quoteKey = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      const fee = data.readUInt32LE(offset);
      offset += 4;
      
      const numDataAccounts = data.readUInt32LE(offset);
      offset += 4;
      
      const lastPrice = data.readDoubleLE(offset);
      offset += 8;
      
      const lpAmount = data.readBigUInt64LE(offset);
      offset += 8;
      
      const borrowCost = data.readDoubleLE(offset);
      offset += 8;
      
      const leverageFrac = data.readDoubleLE(offset);
      offset += 8;
      
      const ammBaseAmount = data.readBigUInt64LE(offset);
      offset += 8;
      
      const ammQuoteAmount = data.readBigUInt64LE(offset);
      offset += 8;
      
      const shortBaseAmount = data.readBigUInt64LE(offset);
      offset += 8;
      
      const longQuoteAmount = data.readBigUInt64LE(offset);
      offset += 8;
      
      const startTime = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Parse plugins (simplified - just skip for now)
      const plugins: AMMPlugin[] = [];
      
      const ammData: AMMData = {
        account_type: accountType,
        pool,
        amm_provider: ammProvider,
        base_mint: baseMint,
        quote_mint: quoteMint,
        lp_mint: lpMint,
        base_key: baseKey,
        quote_key: quoteKey,
        fee,
        num_data_accounts: numDataAccounts,
        last_price: lastPrice,
        lp_amount: Number(lpAmount),
        borrow_cost: borrowCost,
        leverage_frac: leverageFrac,
        amm_base_amount: Number(ammBaseAmount),
        amm_quote_amount: Number(ammQuoteAmount),
        short_base_amount: Number(shortBaseAmount),
        long_quote_amount: Number(longQuoteAmount),
        start_time: Number(startTime),
        plugins
      };
      
      console.log('✅ AMM data parsed successfully:', {
        account_type: ammData.account_type,
        amm_provider: ammData.amm_provider,
        base_mint: ammData.base_mint.toBase58(),
        quote_mint: ammData.quote_mint.toBase58(),
        lp_amount: ammData.lp_amount,
        last_price: ammData.last_price
      });
      
      return ammData;
      
    } catch (deserializeError) {
      console.error('❌ Failed to deserialize AMM data:', deserializeError);
      console.log('📊 Raw account data (first 100 bytes):', 
        Array.from(accountInfo.data.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      );
      return null;
    }
    
  } catch (error) {
    console.error('Error fetching AMM data:', error);
    return null;
  }
}

// Account initialization helper
async function initializeAccount(pda: PublicKey, space: number, user: PublicKey): Promise<TransactionInstruction> {
  const lamports = await connection.getMinimumBalanceForRentExemption(space);
  
  return SystemProgram.createAccount({
    fromPubkey: user,
    newAccountPubkey: pda,
    lamports,
    space,
    programId: PROGRAM_ID,
  });
}

// Check if account exists and initialize if missing
async function ensureAccountExists(pda: PublicKey, space: number, user: PublicKey): Promise<TransactionInstruction | null> {
  try {
    const accountInfo = await connection.getAccountInfo(pda);
    if (accountInfo) {
      console.log(`✅ Account exists: ${pda.toBase58()}`);
      return null; // Account exists, no initialization needed
    } else {
      console.log(`⚠️ Account missing, will initialize: ${pda.toBase58()}`);
      return await initializeAccount(pda, space, user);
    }
  } catch (error) {
    console.warn(`⚠️ Error checking account ${pda.toBase58()}:`, error);
    // If we can't check, assume it needs to be created
    return await initializeAccount(pda, space, user);
  }
}

// Transaction building functions
export async function buildInitTransaction(user: PublicKey): Promise<Transaction> {
  const transaction = new Transaction();
  
  // Get recent blockhash
  let blockhash: string;
  try {
    const result = await connection.getRecentBlockhash();
    blockhash = result.blockhash;
  } catch (error) {
    console.warn('⚠️ Helius RPC failed, trying fallback...', error);
    const fallbackConnection = new Connection(NETWORK.devnet_fallback, 'confirmed');
    const result = await fallbackConnection.getRecentBlockhash();
    blockhash = result.blockhash;
  }
  
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = user;
  
  // Derive PDAs for Init instruction
  const [cookDataPDA] = PublicKey.findProgramAddressSync([Buffer.from('Data')], PROGRAM_ID);
  const [cookPDA] = PublicKey.findProgramAddressSync([Buffer.from('SOL')], PROGRAM_ID);
  
  // Create instruction data for Init
  const instructionData = Buffer.alloc(50);
  let offset = 0;
  
  // Use correct Shank discriminator for Init instruction
  // SHA256 hash of "Init" first 8 bytes: [52, 178, 145, 198, 120, 56, 133, 118]
  const discriminator = new Uint8Array([52, 178, 145, 198, 120, 56, 133, 118]);
  instructionData.set(discriminator, offset);
  offset += 8;
  
  console.log('🔍 Using Init discriminator:', Array.from(discriminator).map(b => b.toString(16).padStart(2, '0')).join(''));
  
  const instruction = new TransactionInstruction({
    keys: [
      // Account 0: user (writable, signer)
      { pubkey: user, isSigner: true, isWritable: true },
      // Account 1: cook_data (writable)
      { pubkey: cookDataPDA, isSigner: false, isWritable: true },
      // Account 2: cook_pda (writable)
      { pubkey: cookPDA, isSigner: false, isWritable: true },
      // Account 3: system_program
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  
  console.log('🔍 Init transaction created:', {
    instructions: transaction.instructions.length,
    recentBlockhash: transaction.recentBlockhash,
    feePayer: transaction.feePayer?.toString(),
    programId: PROGRAM_ID.toString(),
    cookDataPDA: cookDataPDA.toBase58(),
    cookPDA: cookPDA.toBase58()
  });
  
  return transaction;
}

export async function buildCreateLaunchTransaction(
  args: {
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
  },
  user: PublicKey
): Promise<Transaction> {
  const transaction = new Transaction();
  
  // Get recent blockhash with fallback
  let blockhash;
  try {
    const result = await connection.getRecentBlockhash();
    blockhash = result.blockhash;
  } catch (error) {
    console.warn('⚠️ Helius RPC failed, trying fallback...', error);
    // Try fallback RPC
    const fallbackConnection = new Connection(NETWORK.devnet_fallback, 'confirmed');
    const result = await fallbackConnection.getRecentBlockhash();
    blockhash = result.blockhash;
  }
  
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = user;
  
  // Derive PDAs
  // For listing PDA, we need to use a proper mint address
  // Let's create a deterministic mint address using the user's public key and symbol
  const mintSeed = PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from(args.symbol, 'utf8'), Buffer.from('mint')],
    PROGRAM_ID
  )[0];
  const [listingPDA] = getListingPDA(mintSeed, PROGRAM_ID);
  const [launchPDA] = getLaunchDataPDA(args.pageName, PROGRAM_ID);
  const [cookDataPDA] = PublicKey.findProgramAddressSync([Buffer.from('Data')], PROGRAM_ID);
  const [cookPDA] = PublicKey.findProgramAddressSync([Buffer.from('SOL')], PROGRAM_ID);
  
  // Create comprehensive instruction data for CreateLaunch
  const instructionData = Buffer.alloc(1000); // Large buffer for all data
  let offset = 0;
  
  // Serialize CreateArgs using Borsh (matching Rust struct)
  const argsBuffer = Buffer.alloc(500); // Large buffer for CreateArgs
  let argsOffset = 0;
  
  // Serialize CreateArgs fields in order (matching Rust struct)
  // name: String (4-byte length + data)
  const nameBytes = Buffer.from(args.name, 'utf8');
  argsBuffer.writeUInt32LE(nameBytes.length, argsOffset);
  argsOffset += 4;
  argsBuffer.set(nameBytes, argsOffset);
  argsOffset += nameBytes.length;
  
  // symbol: String
  const symbolBytes = Buffer.from(args.symbol, 'utf8');
  argsBuffer.writeUInt32LE(symbolBytes.length, argsOffset);
  argsOffset += 4;
  argsBuffer.set(symbolBytes, argsOffset);
  argsOffset += symbolBytes.length;
  
  // uri: String
  const uriBytes = Buffer.from(args.uri || '', 'utf8');
  argsBuffer.writeUInt32LE(uriBytes.length, argsOffset);
  argsOffset += 4;
  argsBuffer.set(uriBytes, argsOffset);
  argsOffset += uriBytes.length;
  
  // icon: String
  const iconBytes = Buffer.from(args.icon || '', 'utf8');
  argsBuffer.writeUInt32LE(iconBytes.length, argsOffset);
  argsOffset += 4;
  argsBuffer.set(iconBytes, argsOffset);
  argsOffset += iconBytes.length;
  
  // banner: String
  const bannerBytes = Buffer.from(args.banner || '', 'utf8');
  argsBuffer.writeUInt32LE(bannerBytes.length, argsOffset);
  argsOffset += 4;
  argsBuffer.set(bannerBytes, argsOffset);
  argsOffset += bannerBytes.length;
  
  // total_supply: u64
  argsBuffer.writeBigUInt64LE(BigInt(args.totalSupply), argsOffset);
  argsOffset += 8;
  
  // decimals: u8
  argsBuffer.writeUInt8(args.decimals, argsOffset);
  argsOffset += 1;
  
  // launch_date: u64
  argsBuffer.writeBigUInt64LE(BigInt(args.launchDate || Date.now()), argsOffset);
  argsOffset += 8;
  
  // close_date: u64
  argsBuffer.writeBigUInt64LE(BigInt(args.closeDate || Date.now() + 86400000), argsOffset);
  argsOffset += 8;
  
  // num_mints: u32
  argsBuffer.writeUInt32LE(args.numMints || 1000, argsOffset);
  argsOffset += 4;
  
  // ticket_price: u64
  argsBuffer.writeBigUInt64LE(BigInt(args.ticketPrice || 1000000), argsOffset);
  argsOffset += 8;
  
  // page_name: String
  const pageNameBytes = Buffer.from(args.pageName || args.name, 'utf8');
  argsBuffer.writeUInt32LE(pageNameBytes.length, argsOffset);
  argsOffset += 4;
  argsBuffer.set(pageNameBytes, argsOffset);
  argsOffset += pageNameBytes.length;
  
  // transfer_fee: u16
  argsBuffer.writeUInt16LE(args.transferFee || 0, argsOffset);
  argsOffset += 2;
  
  // max_transfer_fee: u64
  argsBuffer.writeBigUInt64LE(BigInt(args.maxTransferFee || 0), argsOffset);
  argsOffset += 8;
  
  // extensions: u8
  argsBuffer.writeUInt8(args.extensions || 0, argsOffset);
  argsOffset += 1;
  
  // amm_provider: u8
  argsBuffer.writeUInt8(args.ammProvider || 0, argsOffset);
  argsOffset += 1;
  
  // launch_type: u8
  argsBuffer.writeUInt8(args.launchType || 0, argsOffset);
  argsOffset += 1;
  
  // whitelist_tokens: u64
  argsBuffer.writeBigUInt64LE(BigInt(args.whitelistTokens || 0), argsOffset);
  argsOffset += 8;
  
  // whitelist_end: u64
  argsBuffer.writeBigUInt64LE(BigInt(args.whitelistEnd || 0), argsOffset);
  argsOffset += 8;
  
  const finalArgsBuffer = argsBuffer.slice(0, argsOffset);
  
  console.log('🔍 CreateArgs serialized:', {
    name: args.name,
    symbol: args.symbol,
    totalSupply: args.totalSupply,
    decimals: args.decimals,
    argsLength: finalArgsBuffer.length
  });
  
  // Simplified approach: Minimal custom program call (like bonk.fun)
  // Focus on making the transaction look like standard token creation
  console.log('🔍 Using minimal custom program approach - cleaner transaction like bonk.fun');
  const instructions: TransactionInstruction[] = [];
  
  
  // Create all required accounts for CreateLaunch instruction (0-16)
  const quoteTokenMint = new PublicKey('So11111111111111111111111111111111111111112'); // WSOL
  const launchQuotePDA = PublicKey.findProgramAddressSync(
    [cookPDA.toBuffer(), Buffer.from('launch_quote')],
    PROGRAM_ID
  )[0];
  const baseTokenMintPDA = PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from(args.symbol, 'utf8'), Buffer.from('mint')],
    PROGRAM_ID
  )[0];
  const cookBaseTokenPDA = PublicKey.findProgramAddressSync(
    [cookPDA.toBuffer(), baseTokenMintPDA.toBuffer()],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL') // Associated Token Program
  )[0];
  const teamPDA = PublicKey.findProgramAddressSync(
    [user.toBuffer(), Buffer.from('team')],
    PROGRAM_ID
  )[0];
  const whitelistPDA = PublicKey.findProgramAddressSync(
    [Buffer.from('whitelist')],
    PROGRAM_ID
  )[0];
  
  // Add missing PDAs for delegate and hook (optional accounts)
  const delegatePDA = PublicKey.findProgramAddressSync(
    [Buffer.from('delegate')],
    PROGRAM_ID
  )[0];
  const hookPDA = PublicKey.findProgramAddressSync(
    [Buffer.from('hook')],
    PROGRAM_ID
  )[0];
  
  console.log('🔍 PDA derivation completed successfully');
  
  // Create program IDs with error handling
  let quoteTokenProgram: PublicKey;
  let baseTokenProgram: PublicKey;
  let associatedTokenProgram: PublicKey;
  let systemProgram: PublicKey;
  
  try {
    quoteTokenProgram = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'); // Token-2022 Program
    baseTokenProgram = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'); // Token-2022 Program
    associatedTokenProgram = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    systemProgram = new PublicKey('11111111111111111111111111111111');
  } catch (error) {
    console.error('❌ Error creating program IDs:', error);
    throw new Error(`Failed to create program IDs: ${error}`);
  }
  
  console.log('🔍 Program IDs validation:', {
    quoteTokenProgram: quoteTokenProgram.toBase58(),
    baseTokenProgram: baseTokenProgram.toBase58(),
    associatedTokenProgram: associatedTokenProgram.toBase58(),
    systemProgram: systemProgram.toBase58()
  });
  
  // Optional accounts (15-16) - already declared above with proper PDA derivation
  
  console.log('🔍 All account PDAs derived:', {
    user: user.toBase58(),
    listingPDA: listingPDA.toBase58(),
    launchPDA: launchPDA.toBase58(),
    quoteTokenMint: quoteTokenMint.toBase58(),
    launchQuotePDA: launchQuotePDA.toBase58(),
    cookDataPDA: cookDataPDA.toBase58(),
    cookPDA: cookPDA.toBase58(),
    baseTokenMintPDA: baseTokenMintPDA.toBase58(),
    cookBaseTokenPDA: cookBaseTokenPDA.toBase58(),
    teamPDA: teamPDA.toBase58(),
    whitelistPDA: whitelistPDA.toBase58()
  });

  // Create instruction using raw instruction builder with ALL 17 required accounts
  const createLaunchInstruction = buildRawInstruction(
    'CREATELAUNCH',
    finalArgsBuffer,
    [
      // Account 0: user (writable, signer) - The user creating the launch
      { pubkey: user, isSigner: true, isWritable: true },
      // Account 1: listing (writable) - Listing data account
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      // Account 2: launch_data (writable) - Launch data account
      { pubkey: launchPDA, isSigner: false, isWritable: true },
      // Account 3: quote_token_mint (writable) - quote token mint (WSOL)
      { pubkey: quoteTokenMint, isSigner: false, isWritable: true },
      // Account 4: launch_quote (writable) - launch quote account
      { pubkey: launchQuotePDA, isSigner: false, isWritable: true },
      // Account 5: cook_data (writable) - Data account for lets cook
      { pubkey: cookDataPDA, isSigner: false, isWritable: true },
      // Account 6: cook_pda (writable) - lets cook PDA
      { pubkey: cookPDA, isSigner: false, isWritable: true },
      // Account 7: base_token_mint (writable) - base token mint
      { pubkey: baseTokenMintPDA, isSigner: false, isWritable: true },
      // Account 8: cook_base_token (writable) - base ATA for LC
      { pubkey: cookBaseTokenPDA, isSigner: false, isWritable: true },
      // Account 9: team (writable) - team account for launch
      { pubkey: teamPDA, isSigner: false, isWritable: true },
      // Account 10: whitelist - whitelist token
      { pubkey: whitelistPDA, isSigner: false, isWritable: false },
      // Account 11: quote_token_program - token program for quote
      { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
      // Account 12: base_token_program - token program for base token
      { pubkey: baseTokenProgram, isSigner: false, isWritable: false },
      // Account 13: associated_token - associated token program
      { pubkey: associatedTokenProgram, isSigner: false, isWritable: false },
      // Account 14: system_program - system program
      { pubkey: systemProgram, isSigner: false, isWritable: false },
      // Account 15: delegate (optional) - PD account
      { pubkey: delegatePDA, isSigner: false, isWritable: false },
      // Account 16: hook (optional) - TH account
      { pubkey: hookPDA, isSigner: false, isWritable: false },
    ],
    PROGRAM_ID
  );
  
  // Add CreateLaunch instruction to the instructions array
  instructions.push(createLaunchInstruction);
  
  // Add all instructions to the transaction
  // Note: This should now be just 1 instruction with ALL 17 accounts (matching Rust CreateLaunch)
  transaction.add(...instructions);
  
  console.log('🔍 Transaction instruction count:', instructions.length, '(should be 1 for CreateLaunch)');
  console.log('🔍 Account count per instruction:', createLaunchInstruction.keys.length, '(should be 17 to match Rust)');
  
  // Log all instruction program IDs to verify our custom program is included
  console.log('🧩 Instructions in transaction:', 
    transaction.instructions.map(i => ({
      programId: i.programId.toBase58(),
      dataLength: i.data.length,
      keysCount: i.keys.length
    }))
  );
  
  // Comprehensive transaction validation and debugging
  console.log('🔍 Transaction validation:', {
    instructions: transaction.instructions.length,
    approach: 'raw instruction builder with ALL 17 accounts (matching Rust)',
    accountCount: createLaunchInstruction.keys.length,
    recentBlockhash: transaction.recentBlockhash,
    feePayer: transaction.feePayer?.toString(),
    programId: PROGRAM_ID.toString(),
    instructionDataLength: createLaunchInstruction.data.length,
    customProgramIncluded: transaction.instructions.some(i => i.programId.equals(PROGRAM_ID)),
    discriminator: Array.from(INSTRUCTION_DISCRIMINATORS.CREATELAUNCH).map(b => b.toString(16).padStart(2, '0')).join(''),
    accounts: createLaunchInstruction.keys.map((key, index) => ({
      index,
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner,
      isWritable: key.isWritable
    }))
  });
  
  // Debug instruction data for deserialization troubleshooting
  console.log('🔧 Instruction debugging info:', {
    discriminatorHex: Array.from(INSTRUCTION_DISCRIMINATORS.CREATELAUNCH).map(b => b.toString(16).padStart(2, '0')).join(''),
    argsLength: finalArgsBuffer.length,
    totalDataLength: createLaunchInstruction.data.length,
    first8Bytes: Array.from(createLaunchInstruction.data.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
    expectedDiscriminator: '82b64e8bd0e46dd2',
    discriminatorMatch: Array.from(createLaunchInstruction.data.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('') === '82b64e8bd0e46dd2'
  });
  
  return transaction;
}

export async function buildBuyTicketsTransaction(
  pageName: string,
  numTickets: number,
  seed: Uint8Array,
  user: PublicKey
): Promise<Transaction> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = user;
  
  // Derive PDAs
  const [userDataPDA] = getUserDataPDA(user, PROGRAM_ID);
  const [joinDataPDA] = getJoinDataPDA(user, pageName, PROGRAM_ID);
  const [launchPDA] = getLaunchDataPDA(pageName, PROGRAM_ID);
  const [cookDataPDA] = PublicKey.findProgramAddressSync([Buffer.from('Data')], PROGRAM_ID);
  
  // Create instruction data using manual serialization
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator
  instructionData.set(Buffer.from(INSTRUCTION_DISCRIMINATORS.BUYTICKETS), offset);
  offset += 8;
  
  // Serialize JoinArgs manually
  instructionData.writeUInt32LE(numTickets, offset);
  offset += 4;
  
  // Add seed data
  instructionData.set(seed.slice(0, 32), offset);
  offset += 32;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userDataPDA, isSigner: false, isWritable: true },
      { pubkey: joinDataPDA, isSigner: false, isWritable: true },
      { pubkey: launchPDA, isSigner: false, isWritable: true },
      { pubkey: cookDataPDA, isSigner: false, isWritable: false },
      // Add system program for SOL transfer
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  return transaction;
}

export async function buildAddLiquidityTransaction(
  baseMint: PublicKey,
  quoteMint: PublicKey,
  amountA: number,
  amountB: number,
  user: PublicKey
): Promise<Transaction> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = user;
  
  // Derive PDAs
  const [ammPDA] = getAMMPDA(baseMint, quoteMint, PROGRAM_ID);
  const [userDataPDA] = getUserDataPDA(user, PROGRAM_ID);
  const [cookDataPDA] = PublicKey.findProgramAddressSync([Buffer.from('Data')], PROGRAM_ID);
  const [cookPDA] = PublicKey.findProgramAddressSync([Buffer.from('SOL')], PROGRAM_ID);
  
  // Create instruction data for Add Liquidity
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator for Add Liquidity
  instructionData.writeUInt32LE(0xca8c8e8a, offset);
  offset += 4;
  instructionData.writeUInt32LE(0xcb8d8f8b, offset);
  offset += 4;
  
  // Add liquidity parameters
  instructionData.writeBigUInt64LE(BigInt(amountA), offset);
  offset += 8;
  instructionData.writeBigUInt64LE(BigInt(amountB), offset);
  offset += 8;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userDataPDA, isSigner: false, isWritable: true },
      { pubkey: ammPDA, isSigner: false, isWritable: true },
      { pubkey: baseMint, isSigner: false, isWritable: true },
      { pubkey: quoteMint, isSigner: false, isWritable: true },
      { pubkey: cookDataPDA, isSigner: false, isWritable: false },
      { pubkey: cookPDA, isSigner: false, isWritable: false },
      // Add system program
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  return transaction;
}

export async function buildRemoveLiquidityTransaction(
  baseMint: PublicKey,
  quoteMint: PublicKey,
  lpTokenAmount: number,
  user: PublicKey
): Promise<Transaction> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = user;
  
  // Derive PDAs
  const [ammPDA] = getAMMPDA(baseMint, quoteMint, PROGRAM_ID);
  const [userDataPDA] = getUserDataPDA(user, PROGRAM_ID);
  const [cookDataPDA] = PublicKey.findProgramAddressSync([Buffer.from('Data')], PROGRAM_ID);
  const [cookPDA] = PublicKey.findProgramAddressSync([Buffer.from('SOL')], PROGRAM_ID);
  
  // Create instruction data for Remove Liquidity
  const instructionData = Buffer.alloc(100);
  let offset = 0;
  
  // Add instruction discriminator for Remove Liquidity
  instructionData.writeUInt32LE(0xda9c9e9a, offset);
  offset += 4;
  instructionData.writeUInt32LE(0xdb9d9f9b, offset);
  offset += 4;
  
  // Add remove liquidity parameters
  instructionData.writeBigUInt64LE(BigInt(lpTokenAmount), offset);
  offset += 8;
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userDataPDA, isSigner: false, isWritable: true },
      { pubkey: ammPDA, isSigner: false, isWritable: true },
      { pubkey: baseMint, isSigner: false, isWritable: true },
      { pubkey: quoteMint, isSigner: false, isWritable: true },
      { pubkey: cookDataPDA, isSigner: false, isWritable: false },
      { pubkey: cookPDA, isSigner: false, isWritable: false },
      // Add system program
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  return transaction;
}

export async function buildSwapTransaction(
  ammPDA: PublicKey,
  side: number,
  inAmount: number,
  user: PublicKey
): Promise<Transaction> {
  const transaction = new Transaction();
  
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = user;
  
  // Create instruction data for CookSwap instruction
  const instructionData = Buffer.alloc(50);
  let offset = 0;
  
  // Use correct Shank discriminator for SwapCookAMM instruction
  // SHA256 hash of "SwapCookAMM" first 8 bytes: [98, 66, 240, 119, 90, 85, 147, 11]
  const discriminator = new Uint8Array([98, 66, 240, 119, 90, 85, 147, 11]);
  instructionData.set(discriminator, offset);
  offset += 8;
  
  // Serialize CookSwapArgs: side: u8, in_amount: u64
  instructionData.writeUInt8(side, offset);
  offset += 1;
  
  instructionData.writeBigUInt64LE(BigInt(inAmount), offset);
  offset += 8;
  
  console.log('🔍 CookSwap instruction data:', {
    discriminator: Array.from(discriminator).map(b => b.toString(16).padStart(2, '0')).join(''),
    side,
    inAmount,
    dataLength: offset
  });
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: ammPDA, isSigner: false, isWritable: true },
      // Add more accounts as needed based on CookSwap instruction requirements
    ],
    programId: PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
  
  transaction.add(instruction);
  return transaction;
}

// Utility functions
export async function getTokenBalance(mint: PublicKey, owner: PublicKey): Promise<number> {
  try {
    const tokenAccounts = await connection.getTokenAccountsByOwner(owner, {
      mint: mint,
    });
    
    if (tokenAccounts.value.length === 0) return 0;
    
    const accountInfo = await connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
    return parseInt(accountInfo.value.amount);
  } catch (error) {
    console.error('Error getting token balance:', error);
    return 0;
  }
}

export async function getSOLBalance(owner: PublicKey): Promise<number> {
  try {
    const balance = await connection.getBalance(owner);
    return balance;
  } catch (error) {
    console.error('Error getting SOL balance:', error);
    return 0;
  }
}

// Service class for handling wallet transactions
export class SolanaProgramService {
  private connection: Connection;
  private fallbackConnection: Connection;

  constructor() {
    this.connection = connection;
    this.fallbackConnection = new Connection(NETWORK.devnet_fallback, 'confirmed');
  }

  // Test connection and get wallet balance with detailed logging
  async testConnectionAndBalance(walletPublicKey: PublicKey): Promise<{balance: number, connection: string}> {
    console.log('🧪 Testing connection and balance for:', walletPublicKey.toString());
    
    let primaryError: any;
    
    // Test primary connection
    try {
      console.log('🔍 Testing primary connection (Helius)...');
      const primaryBalance = await this.connection.getBalance(walletPublicKey);
      const primaryBalanceSOL = primaryBalance / 1e9;
      console.log('✅ Primary connection successful. Balance:', primaryBalanceSOL, 'SOL');
      
      // If primary returns 0, try fallback to verify
      if (primaryBalanceSOL === 0) {
        console.log('⚠️ Primary returned 0 balance, checking fallback...');
        try {
          const fallbackBalance = await this.fallbackConnection.getBalance(walletPublicKey);
          const fallbackBalanceSOL = fallbackBalance / 1e9;
          console.log('🔍 Fallback balance:', fallbackBalanceSOL, 'SOL');
          
          // If fallback has balance, use it instead
          if (fallbackBalanceSOL > 0) {
            console.log('✅ Using fallback connection (has balance)');
            return { balance: fallbackBalanceSOL, connection: 'fallback' };
          }
        } catch (fallbackError) {
          console.warn('⚠️ Fallback check failed:', fallbackError);
        }
      }
      
      return { balance: primaryBalanceSOL, connection: 'primary' };
    } catch (error) {
      primaryError = error;
      console.warn('❌ Primary connection failed:', error);
    }
    
    // Test fallback connection
    try {
      console.log('🔍 Testing fallback connection (public devnet)...');
      const fallbackBalance = await this.fallbackConnection.getBalance(walletPublicKey);
      const fallbackBalanceSOL = fallbackBalance / 1e9;
      console.log('✅ Fallback connection successful. Balance:', fallbackBalanceSOL, 'SOL');
      return { balance: fallbackBalanceSOL, connection: 'fallback' };
    } catch (fallbackError) {
      console.error('❌ Fallback connection also failed:', fallbackError);
      throw new Error(`Both connections failed. Primary error: ${primaryError}, Fallback error: ${fallbackError}`);
    }
  }

  // Instant launch creation
  async createInstantLaunch(
    wallet: any,
    launchData: {
      name: string;
      symbol: string;
      description: string;
      totalSupply: number;
      decimals: number;
      initialPrice?: number;
      liquidityAmount?: number;
      launchType: 'instant';
      programId: string;
      walletAddress: string;
    }
  ): Promise<string> {
    return this.createLaunch(wallet, { ...launchData, launchType: 'instant' });
  }

  // Raffle launch creation
  async createRaffleLaunch(
    wallet: any,
    launchData: {
      name: string;
      symbol: string;
      description: string;
      totalSupply: number;
      decimals: number;
      ticketPrice?: number;
      maxTickets?: number;
      raffleDuration?: number;
      winnerCount?: number;
      launchType: 'raffle';
      programId: string;
      walletAddress: string;
    }
  ): Promise<string> {
    return this.createLaunch(wallet, { ...launchData, launchType: 'raffle' });
  }

  // Generic launch creation using the comprehensive solanaProgram functions
  async createLaunch(
    wallet: any,
    launchData: {
      name: string;
      symbol: string;
      description: string;
      totalSupply: number;
      decimals: number;
      launchType: 'instant' | 'raffle';
      programId: string;
      walletAddress: string;
      [key: string]: any; // Allow additional properties
    }
  ): Promise<string> {
    try {
      console.log('🚀 SolanaProgramService: Creating launch with data:', launchData);
      console.log('🎯 SolanaProgramService: Launch type:', launchData.launchType);

      // Validate wallet and publicKey
      if (!wallet) {
        throw new Error('Wallet is not provided');
      }

      if (!wallet.publicKey) {
        throw new Error('Wallet publicKey is not available. Please connect your wallet.');
      }

      if (!wallet.adapter) {
        throw new Error('Wallet adapter is not available');
      }

      // Check wallet balance for fees with fallback
      console.log('🔍 Checking wallet balance...');
      const balanceResult = await this.testConnectionAndBalance(wallet.publicKey);
      const balanceSOL = balanceResult.balance;
      const balanceLamports = balanceSOL * 1e9;
      
      console.log(`💰 Wallet balance (${balanceResult.connection}):`, balanceSOL, 'SOL');
      
      if (balanceLamports < 5000000) { // Less than 0.005 SOL
          const errorMessage = `Insufficient SOL balance. You have ${balanceSOL.toFixed(6)} SOL, but need at least 0.005 SOL for transaction fees. Please fund your wallet: ${wallet.publicKey.toString()}`;
          console.error('❌ Balance check failed:', errorMessage);
          throw new Error(errorMessage);
      }

      // Generate a unique page name for this launch
      const pageName = `${launchData.symbol.toLowerCase()}_${Date.now()}`;

      // Build the transaction using the comprehensive solanaProgram functions
      // This now includes account existence checking and initialization
      const transaction = await buildCreateLaunchTransaction({
        name: launchData.name,
        symbol: launchData.symbol,
        uri: '', // You might want to add URI support
        icon: '', // You might want to add icon support
        banner: '', // You might want to add banner support
        totalSupply: launchData.totalSupply,
        decimals: launchData.decimals,
        launchDate: Math.floor(Date.now() / 1000), // Current timestamp
        closeDate: Math.floor(Date.now() / 1000) + (launchData.launchType === 'raffle' ? (launchData.raffleDuration || 7 * 24 * 60 * 60) : 0), // 7 days default for raffle
        numMints: launchData.launchType === 'raffle' ? (launchData.maxTickets || 1000) : launchData.totalSupply,
        ticketPrice: launchData.launchType === 'raffle' ? (launchData.ticketPrice || 0.01) : 0,
        pageName: pageName,
        transferFee: 0,
        maxTransferFee: 0,
        extensions: 0,
        ammProvider: launchData.launchType === 'instant' ? 1 : 0, // 1 for instant, 0 for raffle
        launchType: launchData.launchType === 'instant' ? 1 : 0, // 1 for instant, 0 for raffle
        whitelistTokens: 0,
        whitelistEnd: 0,
      }, wallet.publicKey);

      console.log('📝 SolanaProgramService: Transaction created, sending...');
      console.log('🔍 SolanaProgramService: Transaction details:', {
        instructions: transaction.instructions.length,
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer?.toString(),
        signatures: transaction.signatures.length
      });

      // Debug: Log all instruction program IDs to verify our custom program is included
      console.log('🧩 Instructions in transaction:', 
        transaction.instructions.map(i => ({
          programId: i.programId.toBase58(),
          dataLength: i.data.length,
          keysCount: i.keys.length
        }))
      );

      // Verify our custom program is included
      const hasCustomProgram = transaction.instructions.some(i => i.programId.equals(PROGRAM_ID));
      console.log('✅ Custom program included:', hasCustomProgram);
      
      if (!hasCustomProgram) {
        throw new Error('Transaction does not contain instructions for our custom program. Only system programs detected.');
      }

      // Ensure transaction is properly prepared before sending
      try {
        console.log('🔍 SolanaProgramService: Preparing transaction...');
        
        // Get fresh blockhash and set fee payer using the same connection that detected balance
        const connectionForBlockhash = balanceResult.connection === 'fallback' ? this.fallbackConnection : this.connection;
        const { blockhash, lastValidBlockHeight } = await connectionForBlockhash.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        // Ensure wallet is added as a signer (critical for wallet adapter)
        if (!transaction.signatures.some(sig => sig.publicKey.equals(wallet.publicKey))) {
          transaction.signatures.push({
            signature: null,
            publicKey: wallet.publicKey
          });
        }
        
        console.log('📦 Prepared transaction:', {
          recentBlockhash: transaction.recentBlockhash,
          feePayer: transaction.feePayer?.toString(),
          instructions: transaction.instructions.length,
          signatures: transaction.signatures.length,
          signers: transaction.signatures.map(sig => sig.publicKey.toString()),
          lastValidBlockHeight
        });

        // Validate transaction before sending
        try {
          const serialized = transaction.serialize({ requireAllSignatures: false });
          console.log('✅ Transaction serialization successful, size:', serialized.length, 'bytes');
        } catch (serializeError) {
          console.error('❌ Transaction serialization failed:', serializeError);
          throw new Error('Transaction is invalid and cannot be sent');
        }

        // Send transaction using proper wallet handling
        let signature;

        if (wallet.adapter?.sendTransaction) {
          // For wallet-adapter-react (most setups) - call on adapter to maintain this context
          console.log('🔍 SolanaProgramService: Using wallet.adapter.sendTransaction...');
          console.log('🔍 Wallet adapter type:', wallet.adapter.constructor.name);
          console.log('🔍 Wallet connected:', wallet.adapter.connected);
          console.log('🔍 Wallet public key:', wallet.adapter.publicKey?.toString());
          
          // Use the fallback connection for sending since it has the correct balance
          const connectionToUse = balanceResult.connection === 'fallback' ? this.fallbackConnection : this.connection;
          console.log('🔍 Using connection:', balanceResult.connection);
          
          try {
            signature = await wallet.adapter.sendTransaction(transaction, connectionToUse, {
            skipPreflight: false, // Enable preflight for better error detection
            preflightCommitment: 'processed',
            maxRetries: 3,
          });
            console.log("✅ Transaction sent:", signature);
          } catch (sendError: any) {
            console.error("❌ Wallet send error:", sendError);
            if (sendError.name === 'WalletSendTransactionError') {
              console.error("⚙️ Full details:", sendError.message, sendError.stack);
            }
            console.error('❌ Error details:', {
              name: sendError?.name,
              message: sendError?.message,
              stack: sendError?.stack,
              cause: sendError?.cause
            });
            
            // Check for specific error types
            if (sendError?.message?.includes('User rejected')) {
              throw new Error('Transaction was rejected by user');
            } else if (sendError?.message?.includes('Insufficient funds')) {
              throw new Error('Insufficient funds for transaction');
            } else if (sendError?.message?.includes('Blockhash not found')) {
              throw new Error('Transaction expired - please try again');
            } else if (sendError?.message?.includes('Unexpected error')) {
              console.log('🔍 Attempting to get more specific error information...');
              
              // Try with different parameters
              try {
                console.log('🔄 Retrying with skipPreflight: true...');
                signature = await wallet.adapter.sendTransaction(transaction, connectionToUse, {
                  skipPreflight: true,
                  preflightCommitment: 'confirmed',
                  maxRetries: 1,
                });
              } catch (preflightError) {
                console.error('❌ SkipPreflight retry failed:', preflightError);
                
                // Try with different connection if first attempt failed
                if (balanceResult.connection === 'primary') {
                  console.log('🔄 Retrying with fallback connection...');
                  try {
                    signature = await wallet.adapter.sendTransaction(transaction, this.fallbackConnection, {
                      skipPreflight: true,
                      preflightCommitment: 'confirmed',
                      maxRetries: 1,
                    });
                  } catch (retryError) {
                    console.error('❌ All retry attempts failed:', retryError);
                    throw new Error(`Transaction failed: ${sendError?.message}. Please check your wallet connection and try again.`);
                  }
                } else {
                  throw new Error(`Transaction failed: ${sendError?.message}. Please check your wallet connection and try again.`);
                }
              }
            } else {
              throw sendError;
            }
          }
          
          console.log('✅ Transaction sent:', signature);
          
          // Confirm transaction with proper parameters and detailed error checking
          try {
            const confirmation = await this.connection.confirmTransaction({ 
            signature, 
            blockhash, 
            lastValidBlockHeight 
          }, 'confirmed');
            
            console.log('🔍 Transaction confirmation:', confirmation);
            
            if (confirmation.value.err) {
              console.error('❌ Transaction failed:', confirmation.value.err);
              throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }
            
            console.log('✅ Transaction confirmed successfully!');
            
            // Get transaction details for debugging
            try {
              const txDetails = await this.connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
              });
              
              console.log('🔍 Transaction details:', {
                signature,
                slot: txDetails?.slot,
                blockTime: txDetails?.blockTime,
                meta: txDetails?.meta,
                logs: txDetails?.meta?.logMessages
              });
              
              // Log program logs for debugging
              if (txDetails?.meta?.logMessages) {
                console.log('📋 Program logs:');
                txDetails.meta.logMessages.forEach((log, index) => {
                  console.log(`  ${index + 1}. ${log}`);
                });
              }
              
              // Check for specific errors in logs
              const errorLogs = txDetails?.meta?.logMessages?.filter(log => 
                log.includes('Error') || log.includes('Failed') || log.includes('Unknown')
              );
              
              if (errorLogs && errorLogs.length > 0) {
                console.error('❌ Error logs found:', errorLogs);
              }
              
            } catch (txDetailsError) {
              console.warn('⚠️ Could not fetch transaction details:', txDetailsError);
            }
            
          } catch (confirmationError) {
            console.error('❌ Transaction confirmation failed:', confirmationError);
            throw confirmationError;
          }
          
        } else if (wallet.signTransaction && wallet.publicKey) {
          // For Phantom / Solflare direct API
          console.log('🔍 SolanaProgramService: Using wallet.signTransaction...');
          const signedTx = await wallet.signTransaction(transaction);
          signature = await this.connection.sendRawTransaction(signedTx.serialize());
          
          console.log('✅ Transaction sent:', signature);
          
          // Confirm transaction
          await this.connection.confirmTransaction(signature, 'confirmed');
        } else {
          throw new Error("Unsupported wallet object - no sendTransaction or signTransaction method found");
        }
        
        return signature;
        
      } catch (error) {
        console.error('❌ SolanaProgramService: Transaction failed:', error);
        console.error('❌ SolanaProgramService: Error details:', {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack
        });
        
        // Check if it's a network/RPC error
        if ((error as Error).message?.includes('Failed to fetch') || (error as Error).message?.includes('Network')) {
          throw new Error('Network error: Please check your internet connection and try again.');
        }
        
        // Check if it's a wallet error
        if ((error as Error).message?.includes('User rejected') || (error as Error).message?.includes('rejected')) {
          throw new Error('Transaction was cancelled by user.');
        }
        
        // Check if it's a simulation error
        if ((error as Error).message?.includes('simulation') || (error as Error).message?.includes('Transaction simulation failed')) {
          throw new Error('Transaction failed simulation. Please check your wallet balance and try again.');
        }
        
        throw error;
      }
    } catch (error) {
      console.error('❌ SolanaProgramService: Error creating launch:', error);
      throw error;
    }
  }
}
