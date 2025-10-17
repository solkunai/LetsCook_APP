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
      
      // Convert blockchain data to LaunchData format
      const launches: LaunchData[] = blockchainLaunches.map(launch => ({
        id: launch.id,
        name: launch.name,
        symbol: launch.symbol,
        description: launch.description,
        image: launch.image,
        banner: launch.banner,
        metadataUri: launch.metadataUri,
        launchType: launch.launchType,
        status: launch.status,
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
        baseTokenMint: launch.id, // Simplified
        quoteTokenMint: 'So11111111111111111111111111111111111111112', // SOL
        dexProvider: 0, // CookDEX
        rawMetadata: launch.rawMetadata
      }));

      return launches;
    } catch (error) {
      console.error('Error fetching launches:', error);
      return [];
    }
  }

  /**
   * Get launch by ID
   */
  async getLaunchById(id: string): Promise<LaunchData | null> {
    try {
      const blockchainLaunch = await blockchainIntegrationService.getLaunchByAddress(id);
      if (!blockchainLaunch) {
        return null;
      }

      // Convert blockchain data to LaunchData format
      return {
        id: blockchainLaunch.id,
        name: blockchainLaunch.name,
        symbol: blockchainLaunch.symbol,
        description: blockchainLaunch.description,
        image: blockchainLaunch.image,
        launchType: blockchainLaunch.launchType,
        status: blockchainLaunch.status,
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
        baseTokenMint: blockchainLaunch.id,
        quoteTokenMint: 'So11111111111111111111111111111111111111112',
        dexProvider: 0
      };
    } catch (error) {
      console.error('Error fetching launch by ID:', error);
      return null;
    }
  }
}

// Export a default instance
export const launchDataService = new LaunchDataService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);