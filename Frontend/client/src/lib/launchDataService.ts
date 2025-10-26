import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from './nativeProgram';
import { blockchainIntegrationService, BlockchainLaunchData } from './blockchainIntegrationService';
import { InstantLaunchMarketDataService } from './instantLaunchMarketDataService';

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
  private instantMarketDataService: InstantLaunchMarketDataService;

  constructor(connection: Connection) {
    this.connection = connection;
    this.instantMarketDataService = new InstantLaunchMarketDataService(connection);
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
      const launches: LaunchData[] = await Promise.all(blockchainLaunches.map(async (launch) => {
        // Calculate status based on launch type and dates
        let status: 'upcoming' | 'live' | 'ended' = 'live';
        const now = Date.now();
        
        if (launch.launchType === 'instant') {
          status = 'live';
        } else if (launch.launchType === 'raffle') {
          const launchTime = launch.launchDate instanceof Date ? launch.launchDate.getTime() : new Date(launch.launchDate).getTime();
          const endTime = launch.endDate instanceof Date ? launch.endDate.getTime() : new Date(launch.endDate).getTime();
          
          if (now < launchTime) {
            status = 'upcoming';
          } else if (now > endTime) {
            status = 'ended';
          } else {
            status = 'live';
          }
        }

        // For instant launches, get real market data
        let marketData = {
          currentPrice: launch.ticketPrice,
          priceChange24h: 0,
          volume24h: 0,
          marketCap: launch.totalSupply * launch.ticketPrice,
          liquidity: 0
        };

        if (launch.launchType === 'instant') {
          try {
            const realMarketData = await this.instantMarketDataService.getMarketData(
              launch.accountAddress,
              launch.baseTokenMint || launch.id
            );
            marketData = {
              currentPrice: realMarketData.price,
              priceChange24h: realMarketData.priceChange24h,
              volume24h: realMarketData.volume24h,
              marketCap: realMarketData.marketCap,
              liquidity: realMarketData.liquidity
            };
          } catch (error) {
            console.error('Error fetching real market data for instant launch:', error);
            // Fallback to basic data
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
          currentPrice: marketData.currentPrice,
          priceChange24h: marketData.priceChange24h,
          volume24h: marketData.volume24h,
          marketCap: marketData.marketCap,
          liquidity: marketData.liquidity,
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
      }));

      return launches;
    } catch (error) {
      console.error('Error fetching launches:', error);
      return [];
    }
  }

  /**
   * Get mock launches for development/testing - REMOVED
   * All launches should come from real blockchain data only
   */
  private getMockLaunches(): LaunchData[] {
    // No mock data - only real blockchain data
    return [];
  }

  /**
   * Get launch by ID
   */
  async getLaunchById(id: string): Promise<LaunchData | null> {
    try {
      // Only fetch real blockchain data - no mock data
      const blockchainLaunch = await blockchainIntegrationService.getLaunchByAddress(id);
      if (!blockchainLaunch) {
        return null;
      }

      // Calculate status based on launch type and dates
      let status: 'upcoming' | 'live' | 'ended' = 'live';
      const now = Date.now();
      
      // Helper function to safely get time from date
      const safeGetTime = (dateValue: any): number => {
        try {
          if (dateValue instanceof Date) {
            return dateValue.getTime();
          } else if (typeof dateValue === 'number') {
            return dateValue;
          } else if (typeof dateValue === 'string') {
            return new Date(dateValue).getTime();
          } else {
            console.warn('⚠️ Invalid date value in launchDataService:', dateValue);
            return Date.now();
          }
        } catch (error) {
          console.warn('⚠️ Error converting date in launchDataService:', error);
          return Date.now();
        }
      };

      if (blockchainLaunch.launchType === 'instant') {
        // Instant launches are always live once created
        status = 'live';
      } else if (blockchainLaunch.launchType === 'raffle') {
        // Raffle launches have specific start/end times
        const launchTime = safeGetTime(blockchainLaunch.launchDate);
        const endTime = safeGetTime(blockchainLaunch.endDate);
        
        if (now < launchTime) {
          status = 'upcoming';
        } else if (now > endTime) {
          status = 'ended';
        } else {
          status = 'live';
        }
      }

      // For instant launches, get real market data
      let marketData = {
        currentPrice: blockchainLaunch.ticketPrice,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: blockchainLaunch.totalSupply * blockchainLaunch.ticketPrice,
        liquidity: 0
      };

      if (blockchainLaunch.launchType === 'instant') {
        try {
          const realMarketData = await this.instantMarketDataService.getMarketData(
            blockchainLaunch.accountAddress,
            blockchainLaunch.baseTokenMint || blockchainLaunch.id
          );
          marketData = {
            currentPrice: realMarketData.price,
            priceChange24h: realMarketData.priceChange24h,
            volume24h: realMarketData.volume24h,
            marketCap: realMarketData.marketCap,
            liquidity: realMarketData.liquidity
          };
        } catch (error) {
          console.error('Error fetching real market data for instant launch:', error);
          // Fallback to basic data
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
        currentPrice: marketData.currentPrice,
        priceChange24h: marketData.priceChange24h,
        volume24h: marketData.volume24h,
        marketCap: marketData.marketCap,
        liquidity: marketData.liquidity,
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