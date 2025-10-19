import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from './nativeProgram';
import { blockchainIntegrationService, BlockchainLaunchData } from './blockchainIntegrationService';

export interface LaunchData {
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
  initialPrice: number;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  launchDate: Date;
  endDate: Date;
  creator: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  ticketPrice?: number;
  maxTickets?: number;
  soldTickets?: number;
  winnerCount?: number;
  hypeScore: number;
  participants: number;
  verified: boolean;
  featured: boolean;
  programId: string;
  listingAccount: string;
  launchDataAccount: string;
  baseTokenMint: string;
  quoteTokenMint: string;
  dexProvider: number; // 0 for Cook, 1 for Raydium
  rawMetadata?: {
    tokenName?: string;
    tokenSymbol?: string;
    tokenUri?: string;
    tokenIcon?: string;
    tokenBanner?: string;
    strings: string[];
    keys: string[];
  };
}

export class LaunchDataService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get all launches from blockchain
   */
  async getAllLaunches(): Promise<LaunchData[]> {
    try {
      const blockchainLaunches = await blockchainIntegrationService.getAllLaunches();
      
      // If no blockchain launches found, return empty array
      if (blockchainLaunches.length === 0) {
        console.log('📝 No blockchain launches found - no launches have been created yet');
        return [];
      }
      
      // Convert blockchain data to LaunchData format
      const launches: LaunchData[] = blockchainLaunches.map(launch => {
        // Calculate status based on launch type and dates
        let status: 'upcoming' | 'live' | 'ended' = 'live';
        const now = Date.now();
        
        if (launch.launchType === 'instant') {
          // Instant launches are always live once created
          status = 'live';
        } else if (launch.launchType === 'raffle') {
          // Raffle launches have specific start/end times
          if (now < launch.launchDate.getTime()) {
            status = 'upcoming';
          } else if (now > launch.endDate.getTime()) {
            status = 'ended';
          } else {
            status = 'live';
          }
        }

        return {
          id: launch.id,
          name: launch.name,
          symbol: launch.symbol,
          description: launch.description,
          image: launch.image,
          banner: launch.banner,
          metadataUri: launch.metadataUri,
          launchType: launch.launchType,
          status: status,
          totalSupply: launch.totalSupply,
          decimals: launch.decimals,
          initialPrice: launch.ticketPrice,
          currentPrice: launch.ticketPrice * (1 + Math.random() * 0.1), // Simulate price change
          priceChange24h: (Math.random() - 0.5) * 20, // Simulate price change
          volume24h: Math.random() * 1000, // Would be calculated from real data
          marketCap: launch.totalSupply * launch.ticketPrice,
          liquidity: Math.random() * 10000, // Would be calculated from real data
          launchDate: launch.launchDate,
          endDate: launch.endDate,
          creator: launch.creator,
          ticketPrice: launch.ticketPrice,
          maxTickets: Math.floor(launch.totalSupply / launch.ticketPrice),
          soldTickets: Math.floor(launch.participants * 0.8), // Estimate
          winnerCount: Math.floor(launch.participants * 0.1), // Estimate
          hypeScore: launch.upvotes + launch.downvotes,
          participants: launch.participants,
          verified: true, // Would be determined from real data
          featured: launch.participants > 100, // Simple feature logic
          programId: launch.programId,
          listingAccount: launch.accountAddress,
          launchDataAccount: launch.accountAddress,
          baseTokenMint: launch.baseTokenMint || launch.id, // Use actual SPL token mint or fallback to launch account
          quoteTokenMint: 'So11111111111111111111111111111111111111112', // SOL
          dexProvider: 0, // CookDEX
          rawMetadata: launch.rawMetadata ? {
            tokenName: launch.rawMetadata.tokenName || undefined,
            tokenSymbol: launch.rawMetadata.tokenSymbol || undefined,
            tokenUri: launch.rawMetadata.tokenUri || undefined,
            tokenIcon: launch.rawMetadata.tokenIcon || undefined,
            tokenBanner: launch.rawMetadata.tokenBanner || undefined,
            strings: launch.rawMetadata.strings,
            keys: launch.rawMetadata.keys
          } : undefined
        };
      });

      return launches;
    } catch (error) {
      console.error('Error fetching launches:', error);
      return [];
    }
  }

  /**
   * Get mock launches for development/testing
   */
  private getMockLaunches(): LaunchData[] {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    return [
      {
        id: 'mock-instant-1',
        name: 'ChefCoin',
        symbol: 'CHEF',
        description: 'The ultimate cooking token for food enthusiasts',
        image: 'https://api.dicebear.com/7.x/shapes/svg?seed=chef&backgroundColor=1e293b&shapeColor=f59e0b',
        launchType: 'instant',
        status: 'live',
        totalSupply: 1000000,
        decimals: 9,
        initialPrice: 0.01,
        currentPrice: 0.012,
        priceChange24h: 20.5,
        volume24h: 15000,
        marketCap: 12000,
        liquidity: 5000,
        launchDate: new Date(now - oneDayMs),
        endDate: new Date(now + oneDayMs),
        creator: '8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV',
        hypeScore: 150,
        participants: 89,
        verified: true,
        featured: true,
        programId: 'ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ',
        listingAccount: 'mock-listing-1',
        launchDataAccount: 'mock-launch-1',
        baseTokenMint: 'mock-token-1',
        quoteTokenMint: 'So11111111111111111111111111111111111111112',
        dexProvider: 0, // CookDEX
        website: 'https://chefcoin.com',
        twitter: 'https://twitter.com/chefcoin'
      },
      {
        id: 'mock-raffle-1',
        name: 'PizzaToken',
        symbol: 'PIZZA',
        description: 'Delicious pizza-themed token with community rewards',
        image: 'https://api.dicebear.com/7.x/shapes/svg?seed=pizza&backgroundColor=1e293b&shapeColor=f59e0b',
        launchType: 'raffle',
        status: 'live',
        totalSupply: 2000000,
        decimals: 9,
        initialPrice: 0.005,
        currentPrice: 0.005,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 10000,
        liquidity: 0,
        launchDate: new Date(now - oneDayMs),
        endDate: new Date(now + 2 * oneDayMs),
        creator: '8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV',
        ticketPrice: 0.005,
        maxTickets: 1000,
        soldTickets: 450,
        winnerCount: 50,
        hypeScore: 89,
        participants: 450,
        verified: true,
        featured: false,
        programId: 'ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ',
        listingAccount: 'mock-listing-2',
        launchDataAccount: 'mock-launch-2',
        baseTokenMint: 'mock-token-2',
        quoteTokenMint: 'So11111111111111111111111111111111111111112',
        dexProvider: 1, // Raydium
        website: 'https://pizzatoken.com',
        twitter: 'https://twitter.com/pizzatoken'
      },
      {
        id: 'mock-instant-2',
        name: 'CryptoKitchen',
        symbol: 'KITCHEN',
        description: 'Revolutionary kitchen automation token',
        image: 'https://api.dicebear.com/7.x/shapes/svg?seed=kitchen&backgroundColor=1e293b&shapeColor=f59e0b',
        launchType: 'instant',
        status: 'live',
        totalSupply: 500000,
        decimals: 9,
        initialPrice: 0.02,
        currentPrice: 0.018,
        priceChange24h: -10.2,
        volume24h: 8500,
        marketCap: 9000,
        liquidity: 3000,
        launchDate: new Date(now - 2 * oneDayMs),
        endDate: new Date(now + oneDayMs),
        creator: '8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV',
        hypeScore: 67,
        participants: 34,
        verified: false,
        featured: false,
        programId: 'ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ',
        listingAccount: 'mock-listing-3',
        launchDataAccount: 'mock-launch-3',
        baseTokenMint: 'mock-token-3',
        quoteTokenMint: 'So11111111111111111111111111111111111111112',
        dexProvider: 0, // CookDEX
        website: 'https://cryptokitchen.io',
        twitter: 'https://twitter.com/cryptokitchen'
      }
    ];
  }

  /**
   * Get launch by ID
   */
  async getLaunchById(id: string): Promise<LaunchData | null> {
    try {
      // First check if it's a mock launch
      if (id.startsWith('mock-')) {
        const mockLaunches = this.getMockLaunches();
        return mockLaunches.find(launch => launch.id === id) || null;
      }
      
      const blockchainLaunch = await blockchainIntegrationService.getLaunchByAddress(id);
      if (!blockchainLaunch) {
        return null;
      }

      // Calculate status based on launch type and dates
      let status: 'upcoming' | 'live' | 'ended' = 'live';
      const now = Date.now();
      
      if (blockchainLaunch.launchType === 'instant') {
        // Instant launches are always live once created
        status = 'live';
      } else if (blockchainLaunch.launchType === 'raffle') {
        // Raffle launches have specific start/end times
        if (now < blockchainLaunch.launchDate.getTime()) {
          status = 'upcoming';
        } else if (now > blockchainLaunch.endDate.getTime()) {
          status = 'ended';
        } else {
          status = 'live';
        }
      }

      // Convert blockchain data to LaunchData format
      return {
        id: blockchainLaunch.id,
        name: blockchainLaunch.name,
        symbol: blockchainLaunch.symbol,
        description: blockchainLaunch.description,
        image: blockchainLaunch.image,
        launchType: blockchainLaunch.launchType,
        status: status,
        totalSupply: blockchainLaunch.totalSupply,
        decimals: blockchainLaunch.decimals,
        initialPrice: blockchainLaunch.ticketPrice,
        currentPrice: blockchainLaunch.ticketPrice * (1 + Math.random() * 0.1),
        priceChange24h: (Math.random() - 0.5) * 20,
        volume24h: Math.random() * 1000,
        marketCap: blockchainLaunch.totalSupply * blockchainLaunch.ticketPrice,
        liquidity: Math.random() * 10000,
        launchDate: blockchainLaunch.launchDate,
        endDate: blockchainLaunch.endDate,
        creator: blockchainLaunch.creator,
        ticketPrice: blockchainLaunch.ticketPrice,
        maxTickets: Math.floor(blockchainLaunch.totalSupply / blockchainLaunch.ticketPrice),
        soldTickets: Math.floor(blockchainLaunch.participants * 0.8),
        winnerCount: Math.floor(blockchainLaunch.participants * 0.1),
        hypeScore: blockchainLaunch.upvotes + blockchainLaunch.downvotes,
        participants: blockchainLaunch.participants,
        verified: true,
        featured: blockchainLaunch.participants > 100,
        programId: blockchainLaunch.programId,
        listingAccount: blockchainLaunch.accountAddress,
        launchDataAccount: blockchainLaunch.accountAddress,
        baseTokenMint: blockchainLaunch.baseTokenMint,
        quoteTokenMint: 'So11111111111111111111111111111111111111112',
        dexProvider: 0
      };
    } catch (error) {
      console.error('Error fetching launch by ID:', error);
      return null;
    }
  }

  /**
   * Find a launch by its token mint address
   * This is useful for instant launches where we have the token mint but need the launch account
   */
  async getLaunchByTokenMint(tokenMint: string): Promise<LaunchData | null> {
    try {
      console.log('🔍 Searching for launch by token mint:', tokenMint);
      
      // Get all launches and find the one with matching token mint
      const allLaunches = await this.getAllLaunches();
      const matchingLaunch = allLaunches.find(launch => 
        launch.baseTokenMint === tokenMint
      );
      
      if (matchingLaunch) {
        console.log('✅ Found launch by token mint:', {
          tokenMint,
          launchId: matchingLaunch.id,
          launchDataAccount: matchingLaunch.launchDataAccount
        });
        return matchingLaunch;
      } else {
        console.log('❌ No launch found for token mint:', tokenMint);
        return null;
      }
    } catch (error) {
      console.error('Error finding launch by token mint:', error);
      return null;
    }
  }
}

// Export a default instance
export const launchDataService = new LaunchDataService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);