import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { deserialize } from 'borsh';
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
  baseTokenMint: string; // SPL token mint address
  quoteTokenMint: string; // Quote token mint (usually SOL)
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

  constructor() {
    this.connection = getSimpleConnection();
    // Use your actual deployed program ID
    this.programId = new PublicKey("ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ");
    
    // Debug logging
    console.log('🔍 BlockchainIntegrationService initialized:');
    console.log('  Program ID:', this.programId.toBase58());
    console.log('  Connection RPC:', this.connection.rpcEndpoint);
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
   * Fetch all launches from the blockchain
   */
  async getAllLaunches(): Promise<BlockchainLaunchData[]> {
    try {
      console.log('🔍 Fetching all launches from blockchain...');
      console.log('  Program ID:', this.programId.toBase58());
      console.log('  Connection:', this.connection.rpcEndpoint);
      
      // First, try without any filters to see if there are ANY accounts
      console.log('🔍 Step 1: Checking for ANY accounts...');
      const allAccounts = await this.connection.getProgramAccounts(this.programId);
      console.log(`📊 Found ${allAccounts.length} total accounts for program`);
      
      if (allAccounts.length === 0) {
        console.log('❌ No accounts found for this program ID. Check:');
        console.log('  1. Program ID is correct');
        console.log('  2. Program is deployed to devnet');
        console.log('  3. Program actually creates accounts');
        return [];
      }
      
      // Log first few account details for debugging
      allAccounts.slice(0, 3).forEach((account, index) => {
        console.log(`📋 Account ${index + 1}:`, {
          address: account.pubkey.toBase58(),
          dataLength: account.account.data.length,
          owner: account.account.owner.toBase58(),
          firstBytes: Array.from(account.account.data.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
        });
      });
      
      // Process all accounts without filters to find initialized ones
      console.log('🔍 Step 2: Processing all accounts without filters...');
      const accounts = allAccounts; // Use the accounts we already fetched
      
      // Process all accounts and filter out uninitialized ones
      console.log('🔍 Step 3: Processing all accounts...');
      const launches: BlockchainLaunchData[] = [];
      let processedCount = 0;
      let initializedCount = 0;
      
      for (const { pubkey, account } of accounts) {
        processedCount++;
        
        // Skip uninitialized accounts (all zeros)
        const isAllZeros = account.data.every(byte => byte === 0);
        if (isAllZeros) {
          continue; // Skip this account
        }
        
        initializedCount++;
        console.log(`🔍 Processing initialized account ${initializedCount}/${processedCount}: ${pubkey.toBase58()}`);
        
        try {
          const launchData = await this.parseLaunchAccountData(account.data, pubkey);
          if (launchData) {
            launches.push(launchData);
            console.log(`✅ Successfully parsed: ${launchData.name}`);
          } else {
            console.log(`❌ Failed to parse account: ${pubkey.toBase58()}`);
          }
        } catch (error) {
          console.error('❌ Error parsing launch account:', pubkey.toBase58(), error);
        }
      }
      
      console.log(`📊 Processed ${processedCount} accounts, found ${initializedCount} initialized, parsed ${launches.length} launches`);
      return launches;
    } catch (error) {
      console.error('❌ Error fetching launches:', error);
      return [];
    }
  }

  /**
   * Parse launch account data from raw bytes using manual parsing
   */
  private async parseLaunchAccountData(data: Buffer, accountPubkey: PublicKey): Promise<BlockchainLaunchData | null> {
    try {
      // Check if account is initialized (not all zeros)
      const isAllZeros = data.every(byte => byte === 0);
      if (isAllZeros) {
        console.log(`⚠️  Account ${accountPubkey.toBase58()} is uninitialized (all zeros)`);
        return null;
      }
      
      // Log the first 32 bytes for debugging
      console.log(`🔍 Account ${accountPubkey.toBase58()} first 32 bytes:`, 
        Array.from(data.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Check if this looks like a LaunchData account by checking account_type
      const accountType = data.readUInt8(0);
      if (accountType !== 0) { // 0 = Launch
        console.log(`⚠️  Account ${accountPubkey.toBase58()} is not a Launch account (type: ${accountType})`);
        return null;
      }
      
      // Manual parsing instead of Borsh due to enum complexity
      let offset = 0;
      
      // Read account_type (u8) - already read above
      offset += 1;
      
      // Read launch_meta (u8) - but this might be more complex due to enum variants
      const launchMeta = data.readUInt8(offset);
      offset += 1;
      
      // Read plugins Vec<u8>
      const pluginsLength = data.readUInt32LE(offset);
      offset += 4;
      const plugins = Array.from(data.slice(offset, offset + pluginsLength));
      offset += pluginsLength;
      
      // Read last_interaction (u64)
      const lastInteraction = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read num_interactions (u16)
      const numInteractions = data.readUInt16LE(offset);
      offset += 2;
      
      // Read page_name String
      const pageNameLength = data.readUInt32LE(offset);
      offset += 4;
      const pageName = data.slice(offset, offset + pageNameLength).toString('utf8');
      offset += pageNameLength;
      
      // Read listing String
      const listingLength = data.readUInt32LE(offset);
      offset += 4;
      const listing = data.slice(offset, offset + listingLength).toString('utf8');
      offset += listingLength;
      
      // Read total_supply (u64)
      const totalSupply = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read num_mints (u32)
      const numMints = data.readUInt32LE(offset);
      offset += 4;
      
      // Read ticket_price (u64)
      const ticketPrice = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read minimum_liquidity (u64)
      const minimumLiquidity = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read launch_date (u64)
      const launchDate = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read end_date (u64)
      const endDate = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read tickets_sold (u32)
      const ticketsSold = data.readUInt32LE(offset);
      offset += 4;
      
      // Read ticket_claimed (u32)
      const ticketClaimed = data.readUInt32LE(offset);
      offset += 4;
      
      // Read mints_won (u32)
      const mintsWon = data.readUInt32LE(offset);
      offset += 4;
      
      // Read buffer1 (u64)
      const buffer1 = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read buffer2 (u64)
      const buffer2 = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read buffer3 (u64)
      const buffer3 = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read distribution Vec<u64>
      const distributionLength = data.readUInt32LE(offset);
      offset += 4;
      const distribution = [];
      for (let i = 0; i < distributionLength; i++) {
        distribution.push(data.readBigUInt64LE(offset));
        offset += 8;
      }
      
      // Read flags Vec<u8>
      const flagsLength = data.readUInt32LE(offset);
      offset += 4;
      const flags = Array.from(data.slice(offset, offset + flagsLength));
      offset += flagsLength;
      
      // Read strings Vec<String>
      const stringsLength = data.readUInt32LE(offset);
      offset += 4;
      const strings = [];
      for (let i = 0; i < stringsLength; i++) {
        const stringLength = data.readUInt32LE(offset);
        offset += 4;
        const stringValue = data.slice(offset, offset + stringLength).toString('utf8');
        offset += stringLength;
        strings.push(stringValue);
      }
      
      // Read keys Vec<String>
      const keysLength = data.readUInt32LE(offset);
      offset += 4;
      const keys = [];
      for (let i = 0; i < keysLength; i++) {
        const keyLength = data.readUInt32LE(offset);
        offset += 4;
        const keyValue = data.slice(offset, offset + keyLength).toString('utf8');
        offset += keyLength;
        keys.push(keyValue);
      }
      
      // Extract actual SPL token mint from keys array
      let actualTokenMint = '';
      console.log('🔍 Parsing keys array for token mint:', keys);
      for (const key of keys) {
        console.log('🔍 Checking key:', key, 'length:', key.length);
        // Try to parse as PublicKey to find valid SPL token mints
        try {
          // Skip IPFS hashes and other non-PublicKey strings
          if (key.length === 44 && !key.includes('bafkrei') && !key.includes('Qm')) {
            const publicKey = new PublicKey(key);
            console.log('✅ Found valid PublicKey:', publicKey.toBase58());
            // For instant launches, the first valid PublicKey in keys is usually the token mint
            if (!actualTokenMint) {
              actualTokenMint = publicKey.toBase58();
              console.log('🎯 Using as token mint:', actualTokenMint);
            }
          } else {
            console.log('⚠️ Skipping key (not valid PublicKey):', key);
          }
        } catch (e) {
          console.log('❌ Invalid PublicKey:', key, e);
        }
      }
      console.log('🔍 Final token mint:', actualTokenMint || 'NOT FOUND');
      
      // Read creator Pubkey (32 bytes)
      const creatorBytes = Array.from(data.slice(offset, offset + 32));
      offset += 32;
      const creatorPubkey = new PublicKey(creatorBytes);
      
      // Read upvotes (u32)
      const upvotes = data.readUInt32LE(offset);
      offset += 4;
      
      // Read downvotes (u32)
      const downvotes = data.readUInt32LE(offset);
      offset += 4;
      
      // Read is_tradable (u8)
      const isTradable = data.readUInt8(offset);
      offset += 1;
      
      // Extract token metadata from strings array
      // strings[0]=name, strings[1]=symbol, strings[2]=uri, strings[3]=icon, strings[4]=banner
      const tokenName = strings[0] && strings[0].length > 0 ? strings[0].trim() : null;
      const tokenSymbol = strings[1] && strings[1].length > 0 ? strings[1].trim() : null;
      const tokenUri = strings[2] && strings[2].length > 0 ? strings[2].trim() : null;
      const tokenIcon = strings[3] && strings[3].length > 0 ? strings[3].trim() : null;
      const tokenBanner = strings[4] && strings[4].length > 0 ? strings[4].trim() : null;
      
      console.log(`✅ Successfully parsed account ${accountPubkey.toBase58()}`);
      console.log(`   Account type: ${accountType}`);
      console.log(`   Launch meta: ${launchMeta} (0=Raffle, 1=FCFS/Instant, 2=IDO)`);
      console.log(`   Flags array: [${flags.join(', ')}] (flags[0] = launch_type from creation)`);
      console.log(`   Flags length: ${flags.length}`);
      console.log(`   Page name: ${pageName}`);
      console.log(`   Strings array:`, strings);
      console.log(`   Token name: ${tokenName}, Token symbol: ${tokenSymbol}`);
      console.log(`   Token icon: ${tokenIcon}, Token banner: ${tokenBanner}`);
      
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
        if (url.match(/^[Qmbaf][a-zA-Z0-9]+$/)) {
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
        console.log(`🔍 Using strings array for launch type: strings[6] = "${strings[6]}"`);
        switch (strings[6]) {
          case 'raffle': launchType = 'raffle'; break;
          case 'instant': launchType = 'instant'; break;
          case 'ido': launchType = 'ido'; break;
          default: launchType = 'raffle';
        }
      } else if (flags.length > 0) {
        // Fallback to flags array for older launches
        console.log(`🔍 Using flags array for launch type: flags[0] = ${flags[0]}`);
        switch (flags[0]) {
          case 0: launchType = 'raffle'; break;   // Raffle launch
          case 1: launchType = 'instant'; break;  // Instant launch
          case 2: launchType = 'ido'; break;     // IDO launch
          default: launchType = 'raffle';
        }
      } else {
        // Final fallback to launch_meta
        console.log(`🔍 Using launch_meta for launch type: ${launchMeta}`);
        switch (launchMeta) {
          case 0: launchType = 'raffle'; break;
          case 1: launchType = 'instant'; break;
          case 2: launchType = 'ido'; break;
          default: launchType = 'raffle';
        }
      }
      
      console.log(`🎯 Final launch type determined: ${launchType}`);
      
      // For raffle launches, fetch images from IPFS metadata if strings are empty
      let finalTokenIcon = tokenIcon;
      let finalTokenBanner = tokenBanner;
      
      if (launchType === 'raffle' && (!tokenIcon || !tokenBanner)) {
        console.log('🔍 Raffle launch detected, fetching images from IPFS metadata...');
        try {
          const { IPFSMetadataService } = await import('./ipfsMetadataService');
          const metadata = await IPFSMetadataService.getRaffleImages(accountPubkey.toBase58());
          
          if (metadata) {
            console.log('✅ Found IPFS metadata:', metadata);
            if (metadata.iconHash && !tokenIcon) {
              finalTokenIcon = `https://gateway.pinata.cloud/ipfs/${metadata.iconHash}`;
              console.log('🖼️ Using IPFS icon:', finalTokenIcon);
            }
            if (metadata.bannerHash && !tokenBanner) {
              finalTokenBanner = `https://gateway.pinata.cloud/ipfs/${metadata.bannerHash}`;
              console.log('🖼️ Using IPFS banner:', finalTokenBanner);
            }
          } else {
            console.log('⚠️ No IPFS metadata found for raffle');
          }
        } catch (error) {
          console.error('❌ Error fetching IPFS metadata:', error);
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
      
      // Use actual token metadata if available, otherwise fallback to pageName or account ID
      const displayName = tokenName || pageName || accountPubkey.toBase58().slice(0, 8);
      const displaySymbol = tokenSymbol || pageName.toUpperCase().slice(0, 4) || 'TOKEN';
      const displayImage = displayIcon || `https://api.dicebear.com/7.x/shapes/svg?seed=${displayName}`;
      const displayBannerFinal = displayBanner || displayImage;
  
      return {
        id: accountPubkey.toBase58(),
        name: displayName,
        symbol: displaySymbol,
        description: tokenUri ? `Token metadata: ${tokenUri}` : `Launch for ${displayName}`,
        image: displayImage,
        banner: displayBannerFinal,
        metadataUri: tokenUri || undefined,
        launchType,
        status,
        totalSupply: Number(totalSupply),
        decimals: 9,
        ticketPrice: Number(ticketPrice) / 1e9,
        launchDate: new Date(launchDateMs),
        endDate: new Date(endDateMs),
        creator: creatorPubkey.toBase58(),
        isTradable: isTradable === 1,
        upvotes,
        downvotes,
        participants: upvotes + downvotes,
        programId: this.programId.toBase58(),
        accountAddress: accountPubkey.toBase58(),
        pageName: pageName,
        ticketsSold,
        ticketsClaimed: ticketClaimed,
        mintsWon,
        baseTokenMint: actualTokenMint || accountPubkey.toBase58(), // Use actual SPL token mint or fallback to launch account
        quoteTokenMint: 'So11111111111111111111111111111111111111112', // SOL
        rawMetadata: {
          tokenName, tokenSymbol, tokenUri, tokenIcon, tokenBanner, strings, keys
        }
      };
      
      console.log('🎯 Final BlockchainLaunchData:', {
        id: accountPubkey.toBase58(),
        baseTokenMint: actualTokenMint || accountPubkey.toBase58(),
        actualTokenMintFound: !!actualTokenMint
      });
    } catch (error) {
      console.error('❌ Error parsing launch account data:', {
        accountAddress: accountPubkey.toBase58(),
        dataLength: data.length,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * Fetch specific launch by account address
   */
  async getLaunchByAddress(address: string): Promise<BlockchainLaunchData | null> {
    try {
      const accountPubkey = new PublicKey(address);
      const accountInfo = await this.connection.getAccountInfo(accountPubkey);
      
      if (!accountInfo) {
        return null;
      }

      // Convert Uint8Array to Buffer for proper method access
      const accountDataBuffer = Buffer.from(accountInfo.data);
      return await this.parseLaunchAccountData(accountDataBuffer, accountPubkey);
    } catch (error) {
      console.error('❌ Error fetching launch by address:', error);
      return null;
    }
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
}

// Export singleton instance
export const blockchainIntegrationService = new BlockchainIntegrationService();
