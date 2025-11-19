import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';
import { getSimpleConnection } from './simpleConnection';

export interface RaffleData {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  banner: string;
  metadataUri?: string;
  launchType: 'raffle' | 'instant' | 'ido';
  status: 'upcoming' | 'active' | 'ended' | 'completed';
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
  ticketsSold: number;
  ticketsClaimed: number;
  mintsWon: number;
  baseTokenMint: string;
  quoteTokenMint: string;
  accountAddress: string;
  pageName: string;
  // Compatibility fields for RaffleDetailPage
  votes: { up: number; down: number };
  maxTickets: number;
  soldTickets: number;
  raffleDuration: number;
  winnerCount: number;
  startTime: number;
  endTime: number;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  holders: number;
  initialLiquidity: number;
}

export class RaffleBlockchainService {
  private connection: Connection;
  private readonly PROGRAM_ID: PublicKey;

  constructor() {
    this.connection = getSimpleConnection();
    this.PROGRAM_ID = new PublicKey(
      import.meta.env.VITE_MAIN_PROGRAM_ID || 'J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg'
    );
  }

  /**
   * Fetch all raffles from the blockchain
   */
  async getAllRaffles(): Promise<RaffleData[]> {
    try {
      console.log('🔄 Fetching all raffles from blockchain...');
      
      const accounts = await this.connection.getProgramAccounts(this.PROGRAM_ID, {
        filters: [
          {
            dataSize: 600, // Raffle accounts are 600 bytes
          },
        ],
      });

      console.log(`📊 Found ${accounts.length} accounts, parsing raffles...`);

      const raffles: RaffleData[] = [];

      for (const { pubkey, account } of accounts) {
        try {
          const raffle = await this.parseRaffleAccount(account.data, pubkey);
          if (raffle) {
            raffles.push(raffle);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to parse account ${pubkey.toBase58()}:`, error);
        }
      }

      console.log(`✅ Successfully parsed ${raffles.length} raffles`);
      return raffles;
    } catch (error) {
      console.error('❌ Error fetching raffles:', error);
      return [];
    }
  }

  /**
   * Fetch a specific raffle by ID
   */
  async getRaffleById(raffleId: string): Promise<RaffleData | null> {
    try {
      console.log(`🎫 Fetching raffle: ${raffleId}`);
      
      const accountInfo = await this.connection.getAccountInfo(new PublicKey(raffleId));
      
      if (!accountInfo) {
        console.log('❌ Raffle account not found');
        return null;
      }

      const raffle = await this.parseRaffleAccount(accountInfo.data, new PublicKey(raffleId));
      
      if (raffle) {
        console.log(`✅ Successfully fetched raffle: ${raffle.name}`);
      }
      
      return raffle;
    } catch (error) {
      console.error('❌ Error fetching raffle:', error);
      return null;
    }
  }

  /**
   * Parse raffle account data using the existing blockchainIntegrationService
   */
  private async parseRaffleAccount(data: Buffer, pubkey: PublicKey): Promise<RaffleData | null> {
    try {
      // Use blockchainIntegrationService which already has working parsing logic
      const { blockchainIntegrationService } = await import('./blockchainIntegrationService');
      
      // Use the exported parseLaunchAccountDataSync method
      const parsedData = await blockchainIntegrationService.parseLaunchAccountDataSync(data, pubkey);
      
      if (!parsedData) {
        return null;
      }
      
      // Map the parsed data to our RaffleData interface
      return {
        id: parsedData.id,
        name: parsedData.name,
        symbol: parsedData.symbol,
        description: parsedData.description || '',
        image: parsedData.image,
        banner: parsedData.banner || '',
        metadataUri: parsedData.metadataUri,
        launchType: parsedData.launchType,
        status: parsedData.status === 'live' ? 'active' : parsedData.status === 'ended' ? 'ended' : 'upcoming', // Map 'live' to 'active' for RaffleDetailPage
        totalSupply: parsedData.totalSupply,
        decimals: parsedData.decimals,
        ticketPrice: parsedData.ticketPrice,
        launchDate: parsedData.launchDate,
        endDate: parsedData.endDate,
        creator: parsedData.creator,
        isTradable: parsedData.isTradable,
        upvotes: parsedData.upvotes,
        downvotes: parsedData.downvotes,
        participants: parsedData.participants,
        ticketsSold: parsedData.ticketsSold,
        ticketsClaimed: parsedData.ticketsClaimed,
        mintsWon: parsedData.mintsWon,
        baseTokenMint: parsedData.baseTokenMint,
        quoteTokenMint: parsedData.quoteTokenMint,
        accountAddress: parsedData.accountAddress,
        pageName: parsedData.pageName,
        // Compatibility with RaffleDetailPage interface
        votes: {
          up: parsedData.upvotes,
          down: parsedData.downvotes,
        },
        // Additional fields for RaffleDetailPage
        // Use numMints from blockchain (creator's input) - 0 means unlimited
        maxTickets: parsedData.numMints || 0,
        soldTickets: parsedData.ticketsSold || 0,
        raffleDuration: Math.floor((parsedData.endDate.getTime() - parsedData.launchDate.getTime()) / 1000 / 60 / 60), // duration in hours
        winnerCount: parsedData.mintsWon || 0,
        startTime: Math.floor(parsedData.launchDate.getTime() / 1000),
        endTime: Math.floor(parsedData.endDate.getTime() / 1000),
        website: '',
        twitter: '',
        telegram: '',
        discord: '',
        marketCap: 0,
        liquidity: 0,
        volume24h: 0,
        holders: parsedData.participants || 0,
        initialLiquidity: 0,
      };
    } catch (error) {
      console.error('❌ Error parsing raffle account:', error);
      return null;
    }
  }
}


// Export singleton instance
export const raffleBlockchainService = new RaffleBlockchainService();

