import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { deserialize } from 'borsh';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSimpleConnection } from './simpleConnection';

export interface BlockchainLaunchData {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  banner?: string;
  metadataUri?: string;
  launchType: 'instant' | 'raffle' | 'ido';
  status: 'upcoming' | 'live' | 'ended';
  totalSupply: number;
  decimals: number;
  ticketPrice: number;
  launchDate: Date;
  endDate: Date;
  creator: string;
  isTradable: boolean;
  upvotes: number;
  downvotes: number;
  participants: number;
  programId: string;
  accountAddress: string;
  pageName: string;
  ticketsSold: number;
  ticketsClaimed: number;
  mintsWon: number;
  numMints: number; // Maximum number of tickets (0 means unlimited)
  baseTokenMint: string; // SPL token mint address
  quoteTokenMint: string; // Quote token mint (usually SOL)
  tokensSold?: number; // Tokens sold for instant launches
  isGraduated?: boolean; // Whether instant launch has graduated to AMM
  graduationThreshold?: number; // Graduation threshold in lamports
  dexProvider?: 'cook' | 'raydium'; // DEX provider for liquidity pool
  poolAddress?: string; // Liquidity pool address
  isLiquidityLocked?: boolean; // Whether LP tokens are locked
  lockUnlockDate?: Date; // LP token unlock date
  rawMetadata?: {
    tokenName: string | null;
    tokenSymbol: string | null;
    tokenUri: string | null;
    tokenIcon: string | null;
    tokenBanner: string | null;
    strings: string[];
    keys: string[];
  };
}

export interface BlockchainRaffleData {
  id: string;
  name: string;
  symbol: string;
  ticketPrice: number;
  totalTickets: number;
  soldTickets: number;
  winnerCount: number;
  endTime: Date;
  isActive: boolean;
  isTradable: boolean;
  creator: string;
  participants: string[];
  winners: string[];
}

export interface BlockchainTradingData {
  tokenMint: string;
  volume24h: number;
  price: number;
  priceChange24h: number;
  liquidity: number;
  trades: number;
  marketCap: number;
}

// Borsh schema classes to match Rust structs exactly
class LaunchAccount {
  account_type!: number;
  launch_meta!: number;
  plugins!: Uint8Array;
  last_interaction!: bigint;
  num_interactions!: number;
  page_name!: string;
  listing!: string;
  total_supply!: bigint;
  num_mints!: number;
  ticket_price!: bigint;
  minimum_liquidity!: bigint;
  launch_date!: bigint;
  end_date!: bigint;
  tickets_sold!: number;
  ticket_claimed!: number;
  mints_won!: number;
  buffer1!: bigint;
  buffer2!: bigint;
  buffer3!: bigint;
  distribution!: bigint[];
  flags!: Uint8Array;
  strings!: string[];
  keys!: string[];
  creator!: Uint8Array;
  upvotes!: number;
  downvotes!: number;
  is_tradable!: number; // u8 in Borsh, not boolean

  constructor(fields: Partial<LaunchAccount> = {}) {
    Object.assign(this, fields);
  }
}

// Borsh schema definition - must match Rust struct exactly
const LaunchAccountSchema = new Map([
  [LaunchAccount, {
    kind: 'struct',
    fields: [
      ['account_type', 'u8'],           // AccountType enum (0 = Launch)
      ['launch_meta', 'u8'],            // LaunchMeta enum (0 = Raffle, 1 = FCFS, 2 = IDO)
      ['plugins', ['u8']],              // Vec<u8> - starts with length (u32)
      ['last_interaction', 'u64'],      // u64
      ['num_interactions', 'u16'],      // u16
      ['page_name', 'string'],          // String - starts with length (u32)
      ['listing', 'string'],            // String (Pubkey as string) - starts with length (u32)
      ['total_supply', 'u64'],          // u64
      ['num_mints', 'u32'],             // u32
      ['ticket_price', 'u64'],          // u64
      ['minimum_liquidity', 'u64'],     // u64
      ['launch_date', 'u64'],           // u64
      ['end_date', 'u64'],              // u64
      ['tickets_sold', 'u32'],          // u32
      ['ticket_claimed', 'u32'],        // u32
      ['mints_won', 'u32'],             // u32
      ['buffer1', 'u64'],               // u64
      ['buffer2', 'u64'],               // u64
      ['buffer3', 'u64'],               // u64
      ['distribution', ['u64']],        // Vec<u64> - starts with length (u32)
      ['flags', ['u8']],                // Vec<u8> - starts with length (u32)
      ['strings', ['string']],          // Vec<String> - starts with length (u32)
      ['keys', ['string']],             // Vec<String> - starts with length (u32)
      ['creator', [32]],                // Pubkey (32 bytes)
      ['upvotes', 'u32'],               // u32
      ['downvotes', 'u32'],             // u32
      ['is_tradable', 'u8'],            // bool encoded as u8
    ]
  }]
]);

export class BlockchainIntegrationService {
  private connection: Connection;
  private programId: PublicKey;
  private cache: Map<string, BlockchainLaunchData> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 300000; // 5 minutes cache (increased)
  private readonly PERSISTENT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for localStorage
  
  // Request throttling to prevent 429 errors
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private readonly REQUEST_DELAY = 100; // 100ms delay between requests

  constructor() {
    this.connection = getSimpleConnection();
    // Use your actual deployed program ID
    this.programId = new PublicKey("J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg");
    
    this.loadFromPersistentCache();
  }

  /**
   * Load cached data from localStorage
   */
  private loadFromPersistentCache(): void {
    try {
      const cached = localStorage.getItem('blockchain_launches_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still valid (24 hours)
        if (now - timestamp < this.PERSISTENT_CACHE_DURATION) {
          // Restore cache
          this.cache.clear();
          for (const launch of data) {
            this.cache.set(launch.id, launch);
          }
          this.cacheTimestamp = timestamp;
        } else {
          localStorage.removeItem('blockchain_launches_cache');
        }
      }
    } catch (error) {
      localStorage.removeItem('blockchain_launches_cache');
    }
  }

  /**
   * Save data to localStorage for persistence
   */
  private saveToPersistentCache(launches: BlockchainLaunchData[]): void {
    try {
      const cacheData = {
        data: launches,
        timestamp: Date.now()
      };
      localStorage.setItem('blockchain_launches_cache', JSON.stringify(cacheData));
      console.log('💾 Saved', launches.length, 'launches to persistent cache');
    } catch (error) {
      console.error('❌ Error saving persistent cache:', error);
    }
  }

  /**
   * Get the Solana connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get the program ID
   */
  getProgramId(): PublicKey {
    return this.programId;
  }

  /**
   * Fetch all launches from the blockchain with persistent caching
   * @param forceRefresh - If true, bypasses cache and fetches fresh data
   */
  async getAllLaunches(forceRefresh: boolean = false): Promise<BlockchainLaunchData[]> {
    // Check if we have valid cached data (5 minutes) - unless force refresh
    const now = Date.now();
    if (!forceRefresh && this.cache.size > 0 && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      console.log(`📦 Using cached data (${this.cache.size} launches, ${Math.round((now - this.cacheTimestamp) / 1000)}s old)`);
      return Array.from(this.cache.values());
    }

    try {
      console.log('🔄 Fetching fresh launch data from blockchain...');
      console.log('📍 Program ID:', this.programId.toBase58());
      console.log('🌐 Connection endpoint:', this.connection.rpcEndpoint);
      
      // Single API call to get all accounts at once
      const allAccounts = await this.connection.getProgramAccounts(this.programId, {
        commitment: 'confirmed',
        filters: [] // Get all accounts owned by the program
      });
      
      console.log('📊 Found', allAccounts.length, 'total accounts for program', this.programId.toBase58());
      
      if (allAccounts.length === 0) {
        console.warn('⚠️ No accounts found for this program ID. Possible issues:');
        console.warn('  1. Program ID might be incorrect');
        console.warn('  2. No launches have been created yet');
        console.warn('  3. Connection might be to wrong network (devnet vs mainnet)');
        
        // Try to return cached data if available, even if expired
        if (this.cache.size > 0) {
          console.log('📦 Returning stale cache as fallback...');
          return Array.from(this.cache.values());
        }
        
        return [];
      }
      
      console.log('📊 Found', allAccounts.length, 'total accounts, parsing...');
      
      // Parse all accounts in one go (no individual API calls)
      const launches: BlockchainLaunchData[] = [];
      let initializedCount = 0;
      let skippedZeros = 0;
      let skippedInvalid = 0;
      
      for (const { pubkey, account } of allAccounts) {
        // Skip uninitialized accounts (all zeros)
        const isAllZeros = account.data.every(byte => byte === 0);
        if (isAllZeros) {
          skippedZeros++;
          continue;
        }
        
        initializedCount++;
        
        // Debug: Log each account being processed (only first 5 to avoid spam)
        if (initializedCount <= 5) {
          console.log(`🔍 Processing account ${initializedCount}: ${pubkey.toBase58()}, data length: ${account.data.length}, first byte: ${account.data[0]}`);
        }
        
        try {
          // Parse without making additional API calls
          const launchData = await this.parseLaunchAccountDataSync(account.data, pubkey);
          if (launchData) {
            console.log(`✅ Successfully parsed launch: ${launchData.name} (${launchData.id})`);
            launches.push(launchData);
            this.cache.set(launchData.id, launchData);
          } else {
            skippedInvalid++;
            if (skippedInvalid <= 3) {
              console.log(`⚠️ Account ${pubkey.toBase58()} returned null from parser (not a launch account)`);
            }
          }
        } catch (error) {
          skippedInvalid++;
          if (skippedInvalid <= 3) {
            console.error('❌ Error parsing account:', pubkey.toBase58(), error);
          }
        }
      }
      
      // Update cache and save to localStorage
      this.cacheTimestamp = now;
      this.saveToPersistentCache(launches);
      
      console.log('✅ Parsed', launches.length, 'launches from', initializedCount, 'initialized accounts');
      console.log(`   Skipped: ${skippedZeros} zero accounts, ${skippedInvalid} invalid accounts`);
      
      if (launches.length === 0 && initializedCount > 0) {
        console.warn('⚠️ No valid launches found despite', initializedCount, 'initialized accounts');
        console.warn('   This might indicate a parsing issue or account structure mismatch');
      }
      
      return launches;
    } catch (error) {
      console.error('❌ Error fetching launches:', error);
      
      // Try to return cached data if available, even if expired
      if (this.cache.size > 0) {
        console.log('📦 Returning stale cache as fallback due to error...');
        return Array.from(this.cache.values());
      }
      
      return [];
    }
  }

  /**
   * Parse launch account data synchronously (no API calls)
   */
  async parseLaunchAccountDataSync(data: Buffer, accountPubkey: PublicKey): Promise<BlockchainLaunchData | null> {
    try {
      // Check if account is initialized (not all zeros)
      const isAllZeros = data.every(byte => byte === 0);
      if (isAllZeros) {
        console.log(`  ⏭️ Skipping account ${accountPubkey.toBase58()} - all zeros`);
        return null;
      }
      
      // Check if this looks like a LaunchData account by checking account_type
      const accountType = data.readUInt8(0);
      console.log(`  📝 Account ${accountPubkey.toBase58()} type: ${accountType} (0=Launch, 1=Program, 2=User, 3=Join)`);
      // Temporarily accept both type 0 (Launch) and type 1 (Program) due to account corruption issues
      if (accountType !== 0 && accountType !== 1) {
        console.log(`  ⏭️ Skipping account - not a Launch account (type=${accountType})`);
        return null;
      }
      
      // Helper function to check if we can read the required bytes
      const canRead = (bytes: number): boolean => {
        return offset + bytes <= data.length;
      };
      
      // Helper function to safely read with bounds checking
      const safeRead = {
        u8: (): number => {
          if (!canRead(1)) throw new Error(`Cannot read u8 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readUInt8(offset);
          offset += 1;
          return value;
        },
        u16: (): number => {
          if (!canRead(2)) throw new Error(`Cannot read u16 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readUInt16LE(offset);
          offset += 2;
          return value;
        },
        u32: (): number => {
          if (!canRead(4)) throw new Error(`Cannot read u32 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readUInt32LE(offset);
          offset += 4;
          return value;
        },
        u64: (): bigint => {
          if (!canRead(8)) throw new Error(`Cannot read u64 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readBigUInt64LE(offset);
          offset += 8;
          return value;
        },
        string: (): string => {
          if (!canRead(4)) throw new Error(`Cannot read string length at offset ${offset}, buffer length: ${data.length}`);
          const length = data.readUInt32LE(offset);
          offset += 4;
          
          // Validate string length - if it's too large, the account is likely corrupted
          // Max reasonable string length is buffer size minus current offset (with some buffer)
          const maxReasonableLength = Math.min(data.length - offset, 10000); // Max 10KB string
          if (length > maxReasonableLength) {
            throw new Error(`Invalid string length ${length} at offset ${offset - 4} (buffer length: ${data.length}, max reasonable: ${maxReasonableLength}). Account may be corrupted or uninitialized.`);
          }
          
          if (!canRead(length)) throw new Error(`Cannot read string of length ${length} at offset ${offset}, buffer length: ${data.length}`);
          const value = data.slice(offset, offset + length).toString('utf8');
          offset += length;
          return value;
        },
        bytes: (length: number): Uint8Array => {
          if (!canRead(length)) throw new Error(`Cannot read ${length} bytes at offset ${offset}, buffer length: ${data.length}`);
          const value = data.slice(offset, offset + length);
          offset += length;
          return value;
        },
        i64: (): bigint => {
          if (!canRead(8)) throw new Error(`Cannot read i64 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readBigInt64LE(offset);
          offset += 8;
          return value;
        },
        pubkey: (): PublicKey => {
          if (!canRead(32)) throw new Error(`Cannot read Pubkey at offset ${offset}, buffer length: ${data.length}`);
          const value = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          return value;
        },
        bool: (): boolean => {
          // Borsh serializes bool as u8 (0 = false, 1 = true)
          return safeRead.u8() !== 0;
        }
      };
      
      // Manual parsing without API calls
      let offset = 0;
      
      // Read account_type (u8) - already read above
      offset += 1;
      
      // Read launch_meta enum (LaunchMeta)
      // Enum format: discriminator (u8) + variant data
      const launchMetaDiscriminator = safeRead.u8();
      // 0 = Raffle (empty), 1 = FCFS (empty), 2 = IDO (has f64 + u64)
      if (launchMetaDiscriminator === 2) { // IDO variant
        safeRead.bytes(8); // f64: token_fraction_distributed
        safeRead.bytes(8); // u64: tokens_distributed
      }
      const launchMeta = launchMetaDiscriminator;
      
      // Read plugins Vec<LaunchPlugin> (vector of enums)
      const pluginsLength = safeRead.u32();
      const plugins = [];
      for (let i = 0; i < pluginsLength; i++) {
        const pluginDiscriminator = safeRead.u8();
        // 0 = WhiteListToken(key: Pubkey, quantity: u64, phase_end: u64)
        if (pluginDiscriminator === 0) { // WhiteListToken
          safeRead.bytes(32); // key: Pubkey
          safeRead.bytes(8);  // quantity: u64
          safeRead.bytes(8);  // phase_end: u64
        }
        plugins.push(pluginDiscriminator);
      }
      
      // Read last_interaction (i64, not u64!)
      const lastInteraction = safeRead.i64();
      
      // Read num_interactions (u16)
      const numInteractions = safeRead.u16();
      
      // Read page_name String
      const pageName = safeRead.string();
      
      // Read listing Pubkey (32 bytes, not String)
      const listingPubkey = safeRead.pubkey();
      const listing = listingPubkey.toBase58();
      
      // Read total_supply (u64)
      const totalSupply = safeRead.u64();
      
      // Read num_mints (u32)
      const numMints = safeRead.u32();
      
      // Read ticket_price (u64)
      const ticketPrice = safeRead.u64();
      
      // Read minimum_liquidity (u64)
      const minimumLiquidity = safeRead.u64();
      
      // Read launch_date (u64)
      const launchDate = safeRead.u64();
      
      // Read end_date (u64)
      const endDate = safeRead.u64();
      
      // Read tickets_sold (u32)
      const ticketsSold = safeRead.u32();
      
      // Read ticket_claimed (u32)
      const ticketClaimed = safeRead.u32();
      
      // Read mints_won (u32)
      const mintsWon = safeRead.u32();
      
      // Read buffer1 (u64)
      const buffer1 = safeRead.u64();
      
      // Read buffer2 (u64)
      const buffer2 = safeRead.u64();
      
      // Read buffer3 (u32, not u64!)
      const buffer3 = safeRead.u32();
      
      // Read distribution Vec<u8> (not Vec<u64>!)
      const distributionLength = safeRead.u32();
      const distribution = Array.from(safeRead.bytes(distributionLength));
      
      // Read flags Vec<u8>
      const flagsLength = safeRead.u32();
      const flags = Array.from(safeRead.bytes(flagsLength));
      
      // Read strings Vec<String>
      const stringsLength = safeRead.u32();
      const strings = [];
      for (let i = 0; i < stringsLength; i++) {
        strings.push(safeRead.string());
      }
      
      // Read keys Vec<Pubkey> (not Vec<String>!)
      const keysLength = safeRead.u32();
      const keys = [];
      for (let i = 0; i < keysLength; i++) {
        keys.push(safeRead.pubkey().toBase58());
      }
      
      // Read is_tradable (bool)
      const isTradable = safeRead.bool();
      
      // Read tokens_sold (u64)
      const tokensSold = safeRead.u64();
      
      // Read is_graduated (bool)
      const isGraduated = safeRead.bool();
      
      // Read graduation_threshold (u64)
      const graduationThreshold = safeRead.u64();
      
      // Extract actual SPL token mint from keys array
      // For instant launches: keys[2] (WSOLAddress slot) contains base_token_mint
      // keys[0] = Seller (creator)
      // keys[1] = TeamWallet
      // keys[2] = WSOLAddress (for instant launches, this is base_token_mint)
      let actualTokenMint = '';
      
      // Priority 1: For instant launches, token mint is stored in keys[2] (WSOLAddress slot)
      // We need to verify it's actually a token mint, not just a valid PublicKey
      if (keys.length > 2 && keys[2]) {
        const tokenMintKey = keys[2];
        // Validate it's a valid PublicKey format and not an IPFS hash
        if (tokenMintKey.length === 44 && !tokenMintKey.includes('bafkrei') && !tokenMintKey.includes('Qm')) {
          try {
            const publicKey = new PublicKey(tokenMintKey);
            // Skip if it's the WSOL address (that would be the quote token, not base token)
            if (tokenMintKey !== 'So11111111111111111111111111111111111111112') {
              // For synchronous parsing, we can't verify owner, but we can check format
              // The backend stores base_token_mint in keys[2] for instant launches
              actualTokenMint = tokenMintKey;
            }
          } catch (e) {
            // Not a valid PublicKey, skip
          }
        }
      }
      
      // Priority 2: Search all keys for valid token mints (fallback for older launches or different structures)
      if (!actualTokenMint) {
        for (const key of keys) {
          if (key.length === 44 && !key.includes('bafkrei') && !key.includes('Qm')) {
            try {
              const publicKey = new PublicKey(key);
              // Skip WSOL address if it's found here
              if (publicKey.toBase58() === 'So11111111111111111111111111111111111111112') {
                continue;
              }
              // For synchronous parsing, we can't make RPC calls to verify owner.
              // We'll assume the first valid-looking PublicKey that isn't WSOL is the token mint.
              actualTokenMint = publicKey.toBase58();
              break;
            } catch (e) {
              continue;
            }
          }
        }
      }
      
      // Final fallback: use listing account (derived from token mint)
      if (!actualTokenMint) {
        console.warn('⚠️ No token mint found in keys array, using listing as fallback');
        actualTokenMint = listing; // listing Pubkey (derived from token mint)
      }
      
      // Extract creator from keys array
      // keys[0] = Seller (creator)
      const creatorPubkey = keys.length > 0 ? new PublicKey(keys[0]) : PublicKey.default;
      const upvotes = 0; // No longer in struct
      const downvotes = 0; // No longer in struct
      
      // Extract token metadata from strings array
      const tokenName = strings[0] && strings[0].length > 0 ? strings[0].trim() : null;
      const tokenSymbol = strings[1] && strings[1].length > 0 ? strings[1].trim() : null;
      const tokenUri = strings[2] && strings[2].length > 0 ? strings[2].trim() : null;
      const tokenIcon = strings[3] && strings[3].length > 0 ? strings[3].trim() : null;
      const tokenBanner = strings[4] && strings[4].length > 0 ? strings[4].trim() : null;
      
      // Determine launch type from launchMeta enum discriminator
      // LaunchMeta::Raffle = 0, LaunchMeta::FCFS = 1 (used for instant), LaunchMeta::IDO = 2
      let launchType: 'instant' | 'raffle' | 'ido';
      // Primary: Use launchMeta discriminator (most reliable)
      switch (launchMeta) {
        case 0: launchType = 'raffle'; break;   // LaunchMeta::Raffle
        case 1: launchType = 'instant'; break;  // LaunchMeta::FCFS (used for instant launches)
        case 2: launchType = 'ido'; break;     // LaunchMeta::IDO
        default: launchType = 'raffle';
      }
      
      // Fallback: Check strings array if launchMeta is unclear
      if (launchType === 'raffle' && strings.length > 6 && strings[6]) {
        switch (strings[6]) {
          case 'raffle': launchType = 'raffle'; break;
          case 'instant': launchType = 'instant'; break;
          case 'ido': launchType = 'ido'; break;
        }
      }
      
      // Convert IPFS URLs to HTTP URLs
      const convertIPFSUrl = (url: string | null): string | null => {
        if (!url || url.length === 0) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('ipfs://')) {
          const hash = url.replace('ipfs://', '');
          return `https://gateway.pinata.cloud/ipfs/${hash}`;
        }
        if (url.match(/^[Qmbaf][a-zA-Z0-9]+$/)) {
          return `https://gateway.pinata.cloud/ipfs/${url}`;
        }
        const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
        if (ipfsMatch) {
          return `https://gateway.pinata.cloud/ipfs/${ipfsMatch[1]}`;
        }
        return url;
      };
      
      // Map launch_date and end_date (u64) to Date objects
      const launchDateMs = Number(launchDate) * 1000;
      const endDateMs = Number(endDate) * 1000;
      
      // Determine status based on dates
      const now = Date.now();
      let status: 'upcoming' | 'live' | 'ended';
      if (now < launchDateMs) {
        status = 'upcoming';
      } else if (now > endDateMs) {
        status = 'ended';
      } else {
        status = 'live';
      }
      
      // Convert IPFS URLs to HTTP URLs
      const displayIcon = convertIPFSUrl(tokenIcon);
      const displayBanner = convertIPFSUrl(tokenBanner);
      
      // Note: Sync parser doesn't fetch IPFS metadata (would block)
      // Metadata fetching happens in async parser and LaunchDetailPage
      // Use actual token metadata if available
      const displayName = tokenName || pageName || accountPubkey.toBase58().slice(0, 8);
      const displaySymbol = tokenSymbol || pageName.toUpperCase().slice(0, 4) || 'TOKEN';
      
      // Use icon from blockchain data (metadata image will be fetched async in LaunchDetailPage)
      const finalImage = displayIcon || '';
      
      return {
        id: accountPubkey.toBase58(), // Launch data PDA address (correct!)
        name: displayName,
        symbol: displaySymbol,
        description: tokenUri ? `Token metadata: ${tokenUri}` : `Launch for ${displayName}`,
        image: finalImage, // Use image from metadata URI if available, otherwise use icon
        banner: displayBanner || undefined,
        metadataUri: tokenUri || undefined,
        launchType,
        status,
        totalSupply: Number(totalSupply),
        decimals: 9,
        ticketPrice: Number(ticketPrice) / 1e9,
        launchDate: new Date(launchDateMs),
        endDate: new Date(endDateMs),
        creator: creatorPubkey.toBase58(), // Creator wallet (from keys array)
        isTradable,
        upvotes,
        downvotes,
        tokensSold: Number(tokensSold),
        isGraduated,
        graduationThreshold: Number(graduationThreshold),
        participants: upvotes + downvotes,
        programId: this.programId.toBase58(),
        accountAddress: accountPubkey.toBase58(), // Launch data PDA (this is correct!)
        pageName: pageName,
        ticketsSold,
        ticketsClaimed: ticketClaimed,
        mintsWon,
        numMints: Number(numMints), // Maximum tickets (0 = unlimited)
        baseTokenMint: actualTokenMint || listing, // Use actual SPL token mint or fallback to listing (derived from token mint), NOT accountPubkey
        quoteTokenMint: 'So11111111111111111111111111111111111111112', // SOL
        rawMetadata: {
          tokenName, tokenSymbol, tokenUri, tokenIcon, tokenBanner, strings, keys
        }
      };
    } catch (error) {
      console.error('❌ Error parsing launch account data:', {
        accountAddress: accountPubkey.toBase58(),
        dataLength: data.length,
        error: error instanceof Error ? error.message : error,
        firstBytes: Array.from(data.slice(0, Math.min(32, data.length))).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });
      return null;
    }
  }

  /**
   * Parse launch account data from raw bytes using manual parsing (with API calls)
   */
  private async parseLaunchAccountData(data: Buffer, accountPubkey: PublicKey): Promise<BlockchainLaunchData | null> {
    try {
      // Check if account is initialized (not all zeros)
      const isAllZeros = data.every(byte => byte === 0);
      if (isAllZeros) {
        return null;
      }
      
      // Check if this looks like a LaunchData account by checking account_type
      const accountType = data.readUInt8(0);
      if (accountType !== 0) { // 0 = Launch
        return null;
      }
      
      // Helper function to check if we can read the required bytes
      const canRead = (bytes: number): boolean => {
        return offset + bytes <= data.length;
      };
      
      // Helper function to safely read with bounds checking
      const safeRead = {
        u8: (): number => {
          if (!canRead(1)) throw new Error(`Cannot read u8 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readUInt8(offset);
          offset += 1;
          return value;
        },
        u16: (): number => {
          if (!canRead(2)) throw new Error(`Cannot read u16 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readUInt16LE(offset);
          offset += 2;
          return value;
        },
        u32: (): number => {
          if (!canRead(4)) throw new Error(`Cannot read u32 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readUInt32LE(offset);
          offset += 4;
          return value;
        },
        u64: (): bigint => {
          if (!canRead(8)) throw new Error(`Cannot read u64 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readBigUInt64LE(offset);
          offset += 8;
          return value;
        },
        i64: (): bigint => {
          if (!canRead(8)) throw new Error(`Cannot read i64 at offset ${offset}, buffer length: ${data.length}`);
          const value = data.readBigInt64LE(offset);
          offset += 8;
          return value;
        },
        pubkey: (): PublicKey => {
          if (!canRead(32)) throw new Error(`Cannot read Pubkey at offset ${offset}, buffer length: ${data.length}`);
          const value = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;
          return value;
        },
        string: (): string => {
          if (!canRead(4)) throw new Error(`Cannot read string length at offset ${offset}, buffer length: ${data.length}`);
          const length = data.readUInt32LE(offset);
          offset += 4;
          
          // Validate string length - if it's too large, the account is likely corrupted
          // Max reasonable string length is buffer size minus current offset (with some buffer)
          const maxReasonableLength = Math.min(data.length - offset, 10000); // Max 10KB string
          if (length > maxReasonableLength) {
            throw new Error(`Invalid string length ${length} at offset ${offset - 4} (buffer length: ${data.length}, max reasonable: ${maxReasonableLength}). Account may be corrupted or uninitialized.`);
          }
          
          if (!canRead(length)) throw new Error(`Cannot read string of length ${length} at offset ${offset}, buffer length: ${data.length}`);
          const value = data.slice(offset, offset + length).toString('utf8');
          offset += length;
          return value;
        },
        bytes: (length: number): Uint8Array => {
          if (!canRead(length)) throw new Error(`Cannot read ${length} bytes at offset ${offset}, buffer length: ${data.length}`);
          const value = data.slice(offset, offset + length);
          offset += length;
          return value;
        },
        bool: (): boolean => {
          // Borsh serializes bool as u8 (0 = false, 1 = true)
          return safeRead.u8() !== 0;
        }
      };
      
      // Manual parsing instead of Borsh due to enum complexity
      let offset = 0;
      
      // Read account_type (u8)
      const accountTypeRead = safeRead.u8();
      
      // Read launch_meta enum: u8 discriminator + variant data
      // LaunchMeta::Raffle = 0 (empty struct)
      // LaunchMeta::FCFS = 1 (empty struct)  
      // LaunchMeta::IDO = 2 (f64 + u64)
      const launchMetaDiscriminator = safeRead.u8();
      if (launchMetaDiscriminator === 2) {
        // IDO variant: read f64 + u64
        safeRead.bytes(8); // f64: token_fraction_distributed
        safeRead.bytes(8); // u64: tokens_distributed
      }
      // For Raffle (0) and FCFS (1), no additional data (empty structs)
      const launchMeta = launchMetaDiscriminator;
      
      // Read plugins Vec<LaunchPlugin> (not Vec<u8>)
      // LaunchPlugin is an enum: WhiteListToken(WhiteListToken)
      // Each plugin: u8 discriminator + struct data
      const pluginsLength = safeRead.u32();
      const plugins = [];
      for (let i = 0; i < pluginsLength; i++) {
        const pluginDiscriminator = safeRead.u8();
        if (pluginDiscriminator === 0) {
          // WhiteListToken: Pubkey (32) + u64 + u64
          safeRead.bytes(32); // key: Pubkey
          safeRead.bytes(8);  // quantity: u64
          safeRead.bytes(8);  // phase_end: u64
        }
        plugins.push(pluginDiscriminator);
      }
      
      // Read last_interaction (i64) - signed 64-bit integer
      const lastInteraction = safeRead.i64();
      
      // Read num_interactions (u16)
      const numInteractions = safeRead.u16();
      
      // Read page_name String
      const pageName = safeRead.string();
      
      // Read listing Pubkey (32 bytes, not String)
      const listingPubkey = safeRead.pubkey();
      const listing = listingPubkey.toBase58();
      
      // Read total_supply (u64)
      const totalSupply = safeRead.u64();
      
      // Read num_mints (u32)
      const numMints = safeRead.u32();
      
      // Read ticket_price (u64)
      const ticketPrice = safeRead.u64();
      
      // Read minimum_liquidity (u64)
      const minimumLiquidity = safeRead.u64();
      
      // Read launch_date (u64)
      const launchDate = safeRead.u64();
      
      // Read end_date (u64)
      const endDate = safeRead.u64();
      
      // Read tickets_sold (u32)
      const ticketsSold = safeRead.u32();
      
      // Read ticket_claimed (u32)
      const ticketClaimed = safeRead.u32();
      
      // Read mints_won (u32)
      const mintsWon = safeRead.u32();
      
      // Read buffer1 (u64)
      const buffer1 = safeRead.u64();
      
      // Read buffer2 (u64)
      const buffer2 = safeRead.u64();
      
      // Read buffer3 (u32) - not u64!
      const buffer3 = safeRead.u32();
      
      // Read distribution Vec<u8> (not Vec<u64>)
      const distributionLength = safeRead.u32();
      const distribution = Array.from(safeRead.bytes(distributionLength));
      
      // Read flags Vec<u8>
      const flagsLength = safeRead.u32();
      const flags = Array.from(safeRead.bytes(flagsLength));
      
      // Read strings Vec<String>
      const stringsLength = safeRead.u32();
      const strings = [];
      for (let i = 0; i < stringsLength; i++) {
        strings.push(safeRead.string());
      }
      
      // Read keys Vec<Pubkey> (not Vec<String>)
      const keysLength = safeRead.u32();
      const keys = [];
      for (let i = 0; i < keysLength; i++) {
        keys.push(safeRead.pubkey().toBase58());
      }
      
      // Read instant launch fields (pump.fun-style bonding curve)
      // These fields were added for instant launches
      const isTradable = safeRead.bool();
      const tokensSold = safeRead.u64();
      const isGraduated = safeRead.bool();
      const graduationThreshold = safeRead.u64();
      
      // Extract actual SPL token mint from keys array
      // For instant launches: keys[2] (WSOLAddress slot) contains base_token_mint
      // keys[0] = Seller (creator)
      // keys[1] = TeamWallet
      // keys[2] = WSOLAddress (for instant launches, this is base_token_mint before graduation)
      let actualTokenMint = '';
      
      // Priority 1: Check keys[2] first (where token mint is stored for instant launches)
      if (keys.length > 2 && keys[2]) {
        const tokenMintKey = keys[2];
        if (tokenMintKey.length === 44 && !tokenMintKey.includes('bafkrei') && !tokenMintKey.includes('Qm')) {
          try {
            const publicKey = new PublicKey(tokenMintKey);
            // Verify it's actually a token mint by checking account owner
            const accountInfo = await this.throttledRequest(() => this.connection.getAccountInfo(publicKey));
            if (accountInfo && (
              accountInfo.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58() ||
              accountInfo.owner.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
            )) {
              actualTokenMint = publicKey.toBase58();
            }
          } catch (e) {
            // Skip if invalid
          }
        }
      }
      
      // Priority 2: If keys[2] didn't work, search all keys for token mints
      if (!actualTokenMint) {
        for (const key of keys) {
          // Try to parse as PublicKey to find valid SPL token mints
          try {
            // Skip IPFS hashes and other non-PublicKey strings
            if (key.length === 44 && !key.includes('bafkrei') && !key.includes('Qm')) {
              const publicKey = new PublicKey(key);
              
              // Skip WSOL address
              if (publicKey.toBase58() === 'So11111111111111111111111111111111111111112') {
                continue;
              }
              
              // Check if this PublicKey is actually an SPL token mint
              const accountInfo = await this.throttledRequest(() => this.connection.getAccountInfo(publicKey));
              if (accountInfo && accountInfo.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58()) {
                actualTokenMint = publicKey.toBase58();
                break; // Use the first valid SPL token mint we find
              } else if (accountInfo && accountInfo.owner.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
                // Token 2022 mint
                actualTokenMint = publicKey.toBase58();
                break; // Use the first valid Token 2022 mint we find
              }
            }
          } catch (e) {
            // Silently skip invalid keys
            continue;
          }
        }
      }
      
      // Extract token metadata from strings array
      // strings[0]=name, strings[1]=symbol, strings[2]=uri, strings[3]=icon, strings[4]=banner
      const tokenName = strings[0] && strings[0].length > 0 ? strings[0].trim() : null;
      const tokenSymbol = strings[1] && strings[1].length > 0 ? strings[1].trim() : null;
      const tokenUri = strings[2] && strings[2].length > 0 ? strings[2].trim() : null;
      const tokenIcon = strings[3] && strings[3].length > 0 ? strings[3].trim() : null;
      const tokenBanner = strings[4] && strings[4].length > 0 ? strings[4].trim() : null;
      
      // Successfully parsed - no logging
      
      // Helper function to convert IPFS URLs to HTTP URLs
      const convertIPFSUrl = (url: string | null): string | null => {
        if (!url || url.length === 0) return null;
        
        // If it's already an HTTP URL, return as-is
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return url;
        }
        
        // If it's an IPFS URL (ipfs://...), convert to HTTP
        if (url.startsWith('ipfs://')) {
          const hash = url.replace('ipfs://', '');
          return `https://gateway.pinata.cloud/ipfs/${hash}`;
        }
        
        // If it looks like an IPFS hash (starts with Qm or baf), add gateway
        if (url.match(/^(Qm|baf)[a-zA-Z0-9]+$/)) {
          return `https://gateway.pinata.cloud/ipfs/${url}`;
        }
        
        // If it contains /ipfs/ pattern, extract hash and use Pinata gateway
        const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
        if (ipfsMatch) {
          return `https://gateway.pinata.cloud/ipfs/${ipfsMatch[1]}`;
        }
        
        // Return original URL if no IPFS pattern detected
        return url;
      };
      
      // Use actual token metadata if available, otherwise fallback to pageName or account ID
      // Map launch type from strings array (where launch type is stored as string)
      let launchType: 'instant' | 'raffle' | 'ido';
      
      // Check if strings array has launch type (index 6 for new launches, or fallback to flags/launch_meta)
      if (strings.length > 6 && strings[6]) {
        if (false) { // Disabled logging
          console.log(`🔍 Using strings array for launch type: strings[6] = "${strings[6]}"`);
        }
        switch (strings[6]) {
          case 'raffle': launchType = 'raffle'; break;
          case 'instant': launchType = 'instant'; break;
          case 'ido': launchType = 'ido'; break;
          default: launchType = 'raffle';
        }
      } else if (flags.length > 0) {
        // Fallback to flags array for older launches
        if (false) { // Disabled logging
          console.log(`🔍 Using flags array for launch type: flags[0] = ${flags[0]}`);
        }
        switch (flags[0]) {
          case 0: launchType = 'raffle'; break;   // Raffle launch
          case 1: launchType = 'instant'; break;  // Instant launch
          case 2: launchType = 'ido'; break;     // IDO launch
          default: launchType = 'raffle';
        }
      } else {
        // Final fallback to launch_meta
        if (false) { // Disabled logging
          console.log(`🔍 Using launch_meta for launch type: ${launchMeta}`);
        }
        switch (launchMeta) {
          case 0: launchType = 'raffle'; break;
          case 1: launchType = 'instant'; break;
          case 2: launchType = 'ido'; break;
          default: launchType = 'raffle';
        }
      }
      
      if (false) { // Disabled logging
        console.log(`🎯 Final launch type determined: ${launchType}`);
      }
      
      // For raffle launches, fetch images from IPFS metadata if strings are empty
      let finalTokenIcon = tokenIcon;
      let finalTokenBanner = tokenBanner;
      
      // Reduced logging for production
      if (false) { // Disabled logging
        console.log('🔍 Metadata extraction debug:', {
          launchType,
          tokenIcon,
          tokenBanner,
          tokenUri,
          stringsLength: strings.length,
          strings: strings.slice(0, 5) // First 5 strings for debugging
        });
      }
      
      // First, try to use the images from the strings array if available
      if (tokenIcon && tokenIcon.length > 0) {
        finalTokenIcon = tokenIcon;
      }
      if (tokenBanner && tokenBanner.length > 0) {
        finalTokenBanner = tokenBanner;
      }
      
      // If we still don't have images, try to fetch from Token 2022 metadata extensions
      if ((!finalTokenIcon || !finalTokenBanner) && actualTokenMint) {
          if (false) { // Disabled logging
            console.log('🔍 No images in strings array, trying Token 2022 metadata extensions...');
          }
          try {
            const tokenMintKey = new PublicKey(actualTokenMint);
                const tokenMintInfo = await this.throttledRequest(() => this.connection.getAccountInfo(tokenMintKey));
            
            if (tokenMintInfo && tokenMintInfo.owner.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
              if (false) { // Disabled logging
                console.log('✅ Found Token 2022 mint, reading metadata extensions...');
              }
              
              // Try to read metadata from Token 2022 extensions
              try {
                const metadataUri = this.extractMetadataUriFromMint(tokenMintInfo.data);
                if (metadataUri) {
                  // Fetch the metadata JSON from IPFS
                  const response = await fetch(metadataUri);
                  if (response.ok) {
                    const metadata = await response.json();
                    
                    if (metadata.image && !finalTokenIcon) {
                      finalTokenIcon = metadata.image;
                    }
                    if (metadata.banner && !finalTokenBanner) {
                      finalTokenBanner = metadata.banner;
                    }
                  }
                }
              } catch (metadataError) {
                // Silent fail
              }
            }
          } catch (error) {
            // Silent fail
          }
        }
        
        // If we still don't have images, try to fetch from IPFS metadata (fallback)
        if ((!finalTokenIcon || !finalTokenBanner) && tokenUri) {
          if (false) { // Disabled logging
            console.log('🔍 No images from Token 2022, trying IPFS metadata from tokenUri:', tokenUri);
          }
          try {
            const { IPFSMetadataService } = await import('./ipfsMetadataService');
            const metadata = await IPFSMetadataService.getRaffleImages(accountPubkey.toBase58());
            
            if (metadata) {
              if (false) { // Disabled logging
                console.log('✅ Found IPFS metadata:', metadata);
              }
              if (metadata.iconHash && !finalTokenIcon) {
                finalTokenIcon = `https://gateway.pinata.cloud/ipfs/${metadata.iconHash}`;
                if (false) { // Disabled logging
                  console.log('🖼️ Using IPFS icon:', finalTokenIcon);
                }
              }
              if (metadata.bannerHash && !finalTokenBanner) {
                finalTokenBanner = `https://gateway.pinata.cloud/ipfs/${metadata.bannerHash}`;
                if (false) { // Disabled logging
                  console.log('🖼️ Using IPFS banner:', finalTokenBanner);
                }
              }
            } else {
              if (false) { // Disabled logging
                console.log('⚠️ No IPFS metadata found for raffle');
              }
            }
          } catch (error) {
            // Silent fail
          }
        }
      
      // Map launch_date and end_date (u64) to Date objects
      const launchDateMs = Number(launchDate) * 1000; // Convert seconds to milliseconds
      const endDateMs = Number(endDate) * 1000; // Convert seconds to milliseconds
  
      // Determine status based on dates
      const now = Date.now();
      let status: 'upcoming' | 'live' | 'ended';
      if (now < launchDateMs) {
        status = 'upcoming';
      } else if (now > endDateMs) {
        status = 'ended';
      } else {
        status = 'live';
      }
      
      // Convert IPFS URLs to HTTP URLs using final values
      const displayIcon = convertIPFSUrl(finalTokenIcon);
      const displayBanner = convertIPFSUrl(finalTokenBanner);
      
      // Fetch full metadata from metadata URI if available (for Token-2022 metadata)
      // This ensures we get the correct image, name, and symbol from IPFS
      let metadataImage: string | null = null;
      let metadataName: string | null = null;
      let metadataSymbol: string | null = null;
      if (tokenUri) {
        try {
          const { getFullTokenMetadata } = await import('./ipfsMetadataFetcher');
          const fullMetadata = await getFullTokenMetadata(tokenUri);
          if (fullMetadata) {
            metadataImage = fullMetadata.image || null;
            metadataName = fullMetadata.name || null;
            metadataSymbol = fullMetadata.symbol || null;
            if (metadataImage) {
              console.log('✅ Fetched image from metadata URI (async):', metadataImage);
            }
            if (metadataName) {
              console.log('✅ Fetched name from metadata URI (async):', metadataName);
            }
            if (metadataSymbol) {
              console.log('✅ Fetched symbol from metadata URI (async):', metadataSymbol);
            }
          }
        } catch (error) {
          console.log('⚠️ Could not fetch metadata from URI (async parser):', error);
        }
      }
      
      // Use metadata from IPFS if available, otherwise fallback to blockchain data
      const displayName = metadataName || tokenName || pageName || accountPubkey.toBase58().slice(0, 8);
      const displaySymbol = metadataSymbol || tokenSymbol || pageName.toUpperCase().slice(0, 4) || 'TOKEN';
      
      // Prioritize image from metadata URI over icon
      const displayImage = metadataImage || displayIcon || null;
      const displayBannerFinal = displayBanner || null;
  
      // Extract creator from keys array (Seller or TeamWallet)
      const creatorKey = keys.length > 0 ? keys[0] : accountPubkey.toBase58();
      
      return {
        id: accountPubkey.toBase58(),
        name: displayName,
        symbol: displaySymbol,
        description: tokenUri ? `Token metadata: ${tokenUri}` : `Launch for ${displayName}`,
        image: displayImage || '',
        banner: displayBannerFinal || undefined,
        metadataUri: tokenUri || undefined,
        launchType,
        status,
        totalSupply: Number(totalSupply),
        decimals: 9,
        ticketPrice: Number(ticketPrice) / 1e9,
        launchDate: new Date(launchDateMs),
        endDate: new Date(endDateMs),
        creator: creatorKey, // Use first key (Seller) as creator
        isTradable,
        upvotes: 0, // Not in new structure
        downvotes: 0, // Not in new structure
        tokensSold: Number(tokensSold),
        isGraduated,
        graduationThreshold: Number(graduationThreshold),
        participants: 0, // Not in new structure
        programId: this.programId.toBase58(),
        accountAddress: accountPubkey.toBase58(),
        pageName: pageName,
        ticketsSold,
        ticketsClaimed: ticketClaimed,
        mintsWon,
        numMints: Number(numMints), // Maximum tickets (0 = unlimited)
        baseTokenMint: actualTokenMint || listing, // Use actual SPL token mint or fallback to listing (derived from token mint), NOT accountPubkey
        quoteTokenMint: 'So11111111111111111111111111111111111111112', // SOL
        rawMetadata: {
          tokenName, tokenSymbol, tokenUri, tokenIcon, tokenBanner, strings, keys
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch specific launch by account address using cached data
   */
  async getLaunchByAddress(address: string, retryCount: number = 0, maxRetries: number = 3): Promise<BlockchainLaunchData | null> {
    // Check cache first
    if (this.cache.has(address)) {
      return this.cache.get(address) || null;
    }

    // Try direct account fetch first (for newly created launches)
    try {
      const accountPubkey = new PublicKey(address);
      const accountInfo = await this.throttledRequest(() => 
        this.connection.getAccountInfo(accountPubkey)
      );
      
      if (accountInfo && accountInfo.data.length > 0) {
        // Try to parse directly
        const launchData = await this.parseLaunchAccountDataSync(accountInfo.data, accountPubkey);
        if (launchData) {
          console.log('✅ Found launch via direct account fetch:', address);
          this.cache.set(launchData.id, launchData);
          return launchData;
        }
      }
    } catch (directFetchError) {
      // If direct fetch fails, continue with cache refresh
      if (retryCount === 0) {
        console.log('⚠️ Direct account fetch failed, trying cache refresh:', directFetchError);
      }
    }

    // If not in cache, populate cache first
    if (retryCount === 0) {
      console.log('🔄 Launch not in cache, fetching all launches first...');
    }
    
    try {
      await this.getAllLaunches();
      
      // Check cache again after populating
      if (this.cache.has(address)) {
        console.log('✅ Found launch in cache after refresh:', address);
        return this.cache.get(address) || null;
      }
      
      // If not found and we haven't exhausted retries, wait and retry
      if (retryCount < maxRetries) {
        const waitTime = (retryCount + 1) * 2000; // 2s, 4s, 6s
        console.log(`⏳ Launch not found yet, retrying in ${waitTime/1000}s (attempt ${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.getLaunchByAddress(address, retryCount + 1, maxRetries);
      }
      
      console.log('❌ Launch not found after retries:', address);
      return null;
    } catch (error) {
      // Retry on error if we haven't exhausted retries
      if (retryCount < maxRetries) {
        const waitTime = (retryCount + 1) * 2000;
        console.log(`⚠️ Error fetching launch, retrying in ${waitTime/1000}s (attempt ${retryCount + 1}/${maxRetries})...`, error);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.getLaunchByAddress(address, retryCount + 1, maxRetries);
      }
      
      console.error('❌ Error fetching launch by address after retries:', error);
      return null;
    }
  }

  /**
   * Throttled request to prevent 429 errors
   */
  private async throttledRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  /**
   * Process the request queue with delays
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
          // Add delay between requests to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
        } catch (error) {
          console.error('❌ Request failed:', error);
          // Continue processing other requests even if one fails
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
    if (process.env.NODE_ENV === 'development') {
      console.log('🗑️ Cache cleared');
    }
  }

  /**
   * Force refresh the cache
   */
  async refreshCache(): Promise<BlockchainLaunchData[]> {
    console.log('🔄 Force refreshing cache...');
    this.clearCache();
    return await this.getAllLaunches();
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { size: number; timestamp: number; isExpired: boolean } {
    const now = Date.now();
    const isExpired = (now - this.cacheTimestamp) >= this.CACHE_DURATION;
    return {
      size: this.cache.size,
      timestamp: this.cacheTimestamp,
      isExpired
    };
  }

  /**
   * Fetch raffle data for a specific launch
   */
  async getRaffleData(launchId: string): Promise<BlockchainRaffleData | null> {
    try {
      const launchData = await this.getLaunchByAddress(launchId);
      if (!launchData || launchData.launchType !== 'raffle') {
        return null;
      }

      return {
        id: launchData.id,
        name: launchData.name,
        symbol: launchData.symbol,
        ticketPrice: launchData.ticketPrice,
        totalTickets: Math.floor(launchData.totalSupply / launchData.ticketPrice),
        soldTickets: launchData.ticketsSold,
        winnerCount: launchData.mintsWon,
        endTime: launchData.endDate,
        isActive: launchData.status === 'live',
        isTradable: launchData.isTradable,
        creator: launchData.creator,
        participants: [], // Would need to fetch from separate accounts
        winners: [], // Would need to fetch from separate accounts
      };
    } catch (error) {
      console.error('❌ Error fetching raffle data:', error);
      return null;
    }
  }

  /**
   * Fetch trading data for a specific token
   */
  async getTradingData(tokenMint: string): Promise<BlockchainTradingData | null> {
    try {
      // This would need to integrate with DEX APIs like Raydium
      // For now, return mock data
      return {
        tokenMint,
        volume24h: 0,
        price: 0,
        priceChange24h: 0,
        liquidity: 0,
        trades: 0,
        marketCap: 0,
      };
    } catch (error) {
      console.error('❌ Error fetching trading data:', error);
      return null;
    }
  }

  /**
   * Get user participations
   */
  async getUserParticipations(userPublicKey: string): Promise<BlockchainLaunchData[]> {
    try {
      const userPubkey = new PublicKey(userPublicKey);
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: Buffer.from([0]).toString('base64'),
            },
          },
        ],
      });

      const participations: BlockchainLaunchData[] = [];

      for (const account of accounts) {
        const launchData = await this.parseLaunchAccountData(account.account.data, account.pubkey);
        if (launchData) {
          participations.push(launchData);
        }
      }

      return participations;
    } catch (error) {
      console.error('❌ Error fetching user participations:', error);
      return [];
    }
  }

  /**
   * Get trending launches based on engagement
   */
  async getTrendingLaunches(limit: number = 10): Promise<BlockchainLaunchData[]> {
    try {
      const allLaunches = await this.getAllLaunches();
      
      const trendingLaunches = allLaunches
        .sort((a, b) => (b.upvotes + b.downvotes + b.participants) - (a.upvotes + a.downvotes + a.participants))
        .slice(0, limit);

      return trendingLaunches;
    } catch (error) {
      console.error('❌ Error fetching trending launches:', error);
      return [];
    }
  }

  /**
   * Get active raffles
   */
  async getActiveRaffles(): Promise<BlockchainRaffleData[]> {
    try {
      const allLaunches = await this.getAllLaunches();
      const activeRaffles: BlockchainRaffleData[] = [];

      for (const launch of allLaunches) {
        if (launch.launchType === 'raffle' && launch.status === 'live') {
          const raffleData = await this.getRaffleData(launch.accountAddress);
          if (raffleData) {
            activeRaffles.push(raffleData);
          }
        }
      }

      return activeRaffles;
    } catch (error) {
      console.error('❌ Error fetching active raffles:', error);
      return [];
    }
  }

  /**
   * Get tradable tokens
   */
  async getTradableTokens(): Promise<BlockchainLaunchData[]> {
    try {
      const allLaunches = await this.getAllLaunches();
      return allLaunches.filter(launch => launch.isTradable);
    } catch (error) {
      console.error('❌ Error fetching tradable tokens:', error);
      return [];
    }
  }

  /**
   * Test method to debug account data structure
   */
  async debugAccountData(accountAddress: string): Promise<void> {
    try {
      const accountPubkey = new PublicKey(accountAddress);
      const accountInfo = await this.connection.getAccountInfo(accountPubkey);
      
      if (!accountInfo) {
        console.log('❌ Account not found');
        return;
      }

      console.log('🔍 Account Debug Info:', {
        address: accountAddress,
        dataLength: accountInfo.data.length,
        owner: accountInfo.owner.toBase58(),
        executable: accountInfo.executable,
        rentEpoch: accountInfo.rentEpoch,
        firstBytes: Array.from(accountInfo.data.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });

      // Try to parse the account
      const launchData = await this.parseLaunchAccountData(accountInfo.data, accountPubkey);
      if (launchData) {
        console.log('✅ Successfully parsed launch data:', launchData);
      } else {
        console.log('❌ Failed to parse launch data');
      }
    } catch (error) {
      console.error('❌ Debug error:', error);
    }
  }

  /**
   * Quick test method to check if the service is working
   */
  async quickTest(): Promise<void> {
    console.log('🧪 Running quick test...');
    console.log('Program ID:', this.programId.toBase58());
    console.log('Connection:', this.connection.rpcEndpoint);
    
    try {
      const testLaunches = await this.getAllLaunches();
      console.log('Test result:', testLaunches.length, 'launches found');
    } catch (error) {
      console.error('Test failed:', error);
    }
  }

  /**
   * Test specific problematic accounts that were causing buffer overflow errors
   */
  async testProblematicAccounts(): Promise<void> {
    const problematicAccounts = [
      '3azbK8jpzXjFEtVfmbSPrPM19ePY7jQgAjS73qqFj2eg',
      'BQNXHpLr6UgyoqbKL8eCmZxuiswTzFCrDY3No3YdjNnX',
      '8TuLCQYksma3NoeveyEv4EPagrWCzFGmyyVRrMyHMMoo',
      'BU2HjohFJeeFfvwHzRhz2hiCM1BsVZDJf3ZbRYD3MpHo',
      'Bk4crYxCAPoe5d9ZNpJE1SQGNLW6yaeUbokNkLnSgeqp',
      'DUqXj52yH3Lk26skadfWKKikzZAZGGVWfj95PVPo3CZ9',
      '9m6ce5yfBVf6FcqFBodmJKcD1RcjUtHHMGKJRFw8KqY8',
      'EzBS4bzFWbpvmKhAM6Bbe2RBbUw4kV7xQtdz135UTChj',
      'DTLH5WCstJos9YVX2b54jmtDyxEirJvjT1XJLCaCUEEd'
    ];

    console.log('🧪 Testing problematic accounts with buffer overflow fix...');
    
    for (const accountAddress of problematicAccounts) {
      try {
        console.log(`\n🔍 Testing account: ${accountAddress}`);
        const accountPubkey = new PublicKey(accountAddress);
        const accountInfo = await this.connection.getAccountInfo(accountPubkey);
        
        if (!accountInfo) {
          console.log('❌ Account not found');
          continue;
        }
        
        console.log(`📊 Account data length: ${accountInfo.data.length} bytes`);
        
        // Test the fixed parsing method
        const launchData = await this.parseLaunchAccountDataSync(accountInfo.data, accountPubkey);
        
        if (launchData) {
          console.log('✅ Successfully parsed launch data:', {
            name: launchData.name,
            symbol: launchData.symbol,
            launchType: launchData.launchType,
            status: launchData.status
          });
        } else {
          console.log('⚠️ Account parsed but returned null (likely not a launch account)');
        }
        
      } catch (error) {
        console.error(`❌ Error testing account ${accountAddress}:`, error);
      }
    }
    
    console.log('\n✅ Problematic accounts test completed');
  }

  /**
   * Check for initialized accounts
   */
  async checkAccountInitialization(): Promise<void> {
    console.log('🔍 Checking account initialization...');
    
    try {
      const allAccounts = await this.connection.getProgramAccounts(this.programId);
      console.log(`📊 Found ${allAccounts.length} total accounts`);
      
      let initializedCount = 0;
      let uninitializedCount = 0;
      
      for (const { pubkey, account } of allAccounts.slice(0, 20)) { // Check first 20
        const isAllZeros = account.data.every(byte => byte === 0);
        if (isAllZeros) {
          uninitializedCount++;
          console.log(`❌ Uninitialized: ${pubkey.toBase58()}`);
        } else {
          initializedCount++;
          console.log(`✅ Initialized: ${pubkey.toBase58()}`);
          console.log(`   First 16 bytes:`, Array.from(account.data.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        }
      }
      
      console.log(`📊 Summary: ${initializedCount} initialized, ${uninitializedCount} uninitialized (checked first 20)`);
      
    } catch (error) {
      console.error('❌ Check failed:', error);
    }
  }

  /**
   * Extract metadata URI from Token 2022 mint data
   */
  private extractMetadataUriFromMint(mintData: Uint8Array): string | null {
    try {
      // This is a simplified approach - in a real implementation, you'd need to
      // properly parse the Token 2022 metadata extension data structure
      // For now, we'll try to find common patterns in the data
      
      const dataString = Buffer.from(mintData).toString('utf8');
      
      // Look for common IPFS URL patterns
      const ipfsPatterns = [
        /https:\/\/gateway\.pinata\.cloud\/ipfs\/[a-zA-Z0-9]+/g,
        /ipfs:\/\/[a-zA-Z0-9]+/g,
        /https:\/\/ipfs\.io\/ipfs\/[a-zA-Z0-9]+/g
      ];
      
      for (const pattern of ipfsPatterns) {
        const match = dataString.match(pattern);
        if (match && match[0]) {
          return match[0];
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const blockchainIntegrationService = new BlockchainIntegrationService();
