import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from './nativeProgram';
import { launchDataService, LaunchData } from './launchDataService';
import { ipfsMetadataService } from './ipfsMetadataService';

// Raffle data interface matching what was submitted during creation
export interface RaffleLaunchData {
  id: string;
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

export interface RaffleData {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  banner: string;
  ticketPrice: number;
  maxTickets: number;
  soldTickets: number;
  raffleDuration: number;
  winnerCount: number;
  startTime: number;
  endTime: number;
  status: 'upcoming' | 'active' | 'ended' | 'completed';
  creator: string;
  totalSupply: number;
  decimals: number;
  initialLiquidity: number;
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  votes: { up: number; down: number };
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
}

export class RaffleDataService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Calculate raffle status based on time and ticket sales
   */
  private static getRaffleStatus(launchData: RaffleLaunchData): string {
    const now = Date.now();
    const startTime = launchData.launch_date * 1000;
    const endTime = launchData.close_date * 1000;
    
    if (now < startTime) {
      return 'upcoming';
    } else if (now >= endTime) {
      // Check if all tickets are sold or time has ended
      if (launchData.num_mints === 0) { // Assuming 0 means all tickets sold
        return 'completed';
      } else {
        return 'ended';
      }
    } else {
      return 'active';
    }
  }

  /**
   * Fetch raffle data by ID from blockchain
   */
  async fetchRaffleById(raffleId: string): Promise<RaffleData | null> {
    try {
      console.log('🎫 Fetching raffle data for ID:', raffleId);
      
      // Get the launch account from blockchain
      const launchAccount = new PublicKey(raffleId);
      const accountInfo = await this.connection.getAccountInfo(launchAccount);
      
      if (!accountInfo) {
        console.log('❌ Raffle account not found on blockchain');
        return null;
      }

      console.log('📊 Account found, data length:', accountInfo.data.length);
      console.log('📊 Account owner:', accountInfo.owner.toBase58());
      console.log('📊 Raw data (first 50 bytes):', Array.from(accountInfo.data.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Use the launch service to fetch all launches and find the specific one
      const allLaunches = await launchDataService.getAllLaunches();
      const launchData = allLaunches.find(launch => launch.id === raffleId);
      
      if (!launchData) {
        console.log('❌ Launch not found in fetched launches');
        return null;
      }
      
      // Try to get creator from transaction history (since raffle accounts are typically PDAs owned by the program)
      let creatorAddress = 'Unknown';
      try {
        console.log('🔍 Account owner is program:', accountInfo.owner.toBase58() === PROGRAM_ID.toBase58());
        console.log('🔍 Program ID:', PROGRAM_ID.toBase58());
        
        // Always try to get creator from transaction history for raffle accounts
        creatorAddress = await this.getCreatorFromTransactionHistory(launchAccount);
        
        if (creatorAddress === 'Unknown') {
          console.log('⚠️ Could not find creator in transaction history, trying alternative method...');
          // Fallback: try to get from account metadata if available
          creatorAddress = await this.getCreatorFromAccountMetadata(accountInfo);
        }
      } catch (error) {
        console.log('⚠️ Could not determine creator:', error);
      }

      console.log('✅ Parsed raffle data:', launchData);
      
      // Convert LaunchData to RaffleData format
      const raffleData: RaffleData = {
        id: raffleId,
        name: launchData.name,
        symbol: launchData.symbol,
        description: launchData.description || `A ${launchData.name} token raffle. Buy tickets for a chance to win tokens!`,
        image: launchData.image || '',
        banner: launchData.image || '', // Use same image for banner if no separate banner
        ticketPrice: launchData.ticketPrice || 0.1, // Use ticketPrice from LaunchData
        maxTickets: launchData.maxTickets || 1000,
        soldTickets: 0, // Will be updated from blockchain state
        raffleDuration: Math.floor((launchData.endDate.getTime() - launchData.launchDate.getTime()) / (1000 * 3600)), // Hours
        winnerCount: launchData.maxTickets || 1000, // For now, same as max tickets
        startTime: launchData.launchDate.getTime(),
        endTime: launchData.endDate.getTime(),
        status: launchData.status === 'live' ? 'active' : launchData.status === 'ended' ? 'ended' : 'upcoming',
        creator: creatorAddress,
        totalSupply: launchData.totalSupply,
        decimals: launchData.decimals,
        initialLiquidity: launchData.liquidity || 0,
        website: launchData.website || '',
        twitter: launchData.twitter || '',
        telegram: launchData.telegram || '',
        discord: launchData.discord || '',
        votes: { up: launchData.hypeScore || 0, down: 0 },
        marketCap: launchData.marketCap,
        volume24h: launchData.volume24h,
        liquidity: launchData.liquidity,
        holders: launchData.participants || 0,
      };
      
      return raffleData;
    } catch (error) {
      console.error('Error fetching raffle by ID:', error);
      return null;
    }
  }

  /**
   * Get creator address from transaction history
   */
  private async getCreatorFromTransactionHistory(accountPubkey: PublicKey): Promise<string> {
    try {
      console.log('🔍 Looking for creator in transaction history...');
      
      // Get recent transactions for this account
      const signatures = await this.connection.getSignaturesForAddress(accountPubkey, {
        limit: 20 // Get more transactions to find the creation one
      });
      
      if (signatures.length === 0) {
        console.log('⚠️ No transaction history found');
        return 'Unknown';
      }
      
      console.log('📊 Found', signatures.length, 'transactions');
      
      // Look through transactions to find the creation transaction
      for (let i = signatures.length - 1; i >= 0; i--) {
        const signature = signatures[i];
        console.log('🔍 Checking transaction:', signature.signature);
        
        const transaction = await this.connection.getTransaction(signature.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        
        if (!transaction) {
          console.log('⚠️ Could not fetch transaction details');
          continue;
        }
        
        // Check if this transaction created the account (has our program in instructions)
        const hasOurProgram = transaction.transaction.message.staticAccountKeys.some(key => 
          key.toBase58() === PROGRAM_ID.toBase58()
        );
        
        if (hasOurProgram) {
          console.log('✅ Found creation transaction with our program');
          
          // The creator is typically the fee payer (first signer)
          if (transaction.transaction.message.staticAccountKeys.length > 0) {
            const creator = transaction.transaction.message.staticAccountKeys[0].toBase58();
            console.log('✅ Found creator (fee payer):', creator);
            return creator;
          }
        }
      }
      
      console.log('⚠️ Could not find creation transaction');
      return 'Unknown';
    } catch (error) {
      console.log('⚠️ Error getting creator from transaction history:', error);
      return 'Unknown';
    }
  }

  /**
   * Get creator from account metadata (fallback method)
   */
  private async getCreatorFromAccountMetadata(accountInfo: any): Promise<string> {
    try {
      console.log('🔍 Trying to get creator from account metadata...');
      
      // This is a fallback method - in most cases, raffle accounts won't have creator metadata
      // But we can try to extract it from the account data if it's stored there
      
      // For now, return Unknown as we don't have creator metadata in the account
      return 'Unknown';
    } catch (error) {
      console.log('⚠️ Error getting creator from account metadata:', error);
      return 'Unknown';
    }
  }

  /**
   * Fetch all raffles from the blockchain
   */
  async fetchAllRaffles(): Promise<RaffleData[]> {
    try {
      console.log('🎫 Fetching all raffles from blockchain...');
      
      // Get all launches and filter for raffles
      const allLaunches = await launchDataService.getAllLaunches();
      const raffleLaunches = allLaunches.filter(launch => launch.launchType === 'raffle');
      
      console.log(`📊 Found ${raffleLaunches.length} raffles`);
      
      // Convert to RaffleData format
      const raffles: RaffleData[] = [];
      
      for (const launch of raffleLaunches) {
        try {
          const raffleData = await this.fetchRaffleById(launch.id);
          if (raffleData) {
            raffles.push(raffleData);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to convert launch ${launch.id} to raffle data:`, error);
        }
      }
      
      console.log(`✅ Successfully converted ${raffles.length} raffles`);
      return raffles;
    } catch (error) {
      console.error('❌ Error fetching raffles:', error);
      return [];
    }
  }

  /**
   * Get user's ticket data for a specific raffle
   */
  async getUserTickets(raffleId: string, userPublicKey: string): Promise<{
    ticketCount: number;
    ticketNumbers: number[];
  }> {
    try {
      console.log('🎫 Getting user tickets for raffle:', raffleId, 'user:', userPublicKey);
      
      // For now, return mock data
      // In a real implementation, this would query the blockchain for user's ticket data
      return {
        ticketCount: 0,
        ticketNumbers: []
      };
    } catch (error) {
      console.error('❌ Error getting user tickets:', error);
      return {
        ticketCount: 0,
        ticketNumbers: []
      };
    }
  }

  /**
   * Get raffle statistics
   */
  async getRaffleStats(raffleId: string): Promise<{
    totalTickets: number;
    soldTickets: number;
    remainingTickets: number;
    totalVolume: number;
    uniqueParticipants: number;
  }> {
    try {
      console.log('📊 Getting raffle stats for:', raffleId);
      
      const raffleData = await this.fetchRaffleById(raffleId);
      if (!raffleData) {
        throw new Error('Raffle not found');
      }
      
      return {
        totalTickets: raffleData.maxTickets,
        soldTickets: raffleData.soldTickets,
        remainingTickets: raffleData.maxTickets - raffleData.soldTickets,
        totalVolume: raffleData.soldTickets * raffleData.ticketPrice,
        uniqueParticipants: raffleData.holders
      };
    } catch (error) {
      console.error('❌ Error getting raffle stats:', error);
      return {
        totalTickets: 0,
        soldTickets: 0,
        remainingTickets: 0,
        totalVolume: 0,
        uniqueParticipants: 0
      };
    }
  }
}

// Export a default instance
export const raffleDataService = new RaffleDataService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);