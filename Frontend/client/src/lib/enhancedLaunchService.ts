import { Connection, PublicKey } from '@solana/web3.js';
import { launchDataService } from './launchDataService';
import { raffleDataService } from './raffleDataService';
import { realLaunchService } from './realLaunchService';
import type { LaunchData } from './launchDataService';
import type { RaffleData } from './raffleDataService';

export interface EnhancedLaunchData extends LaunchData {
  // Additional fields for enhanced functionality
  raffleData?: RaffleData;
  isInstantLaunch: boolean;
  isRaffleLaunch: boolean;
  isIDOLaunch: boolean;
  liquidityPoolStatus?: 'active' | 'inactive' | 'pending';
  tradingVolume?: number;
  priceChange24h?: number;
  holdersCount?: number;
}

export interface LaunchTypeSummary {
  instant: EnhancedLaunchData[];
  raffle: EnhancedLaunchData[];
  ido: EnhancedLaunchData[];
  total: number;
}

export class EnhancedLaunchService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Fetch all launches with enhanced data for different types
   */
  async fetchAllLaunchesEnhanced(): Promise<EnhancedLaunchData[]> {
    try {
      console.log('🚀 Enhanced Launch Service: Fetching all launches...');
      
      // Fetch base launches from blockchain
      const baseLaunches = await launchDataService.getAllLaunches();
      console.log(`📊 Found ${baseLaunches.length} base launches`);

      // Fetch raffle-specific data
      const raffleData = await raffleDataService.fetchAllRaffles();
      console.log(`🎫 Found ${raffleData.length} raffles`);

      // Create a map of raffle data by ID for quick lookup
      const raffleDataMap = new Map<string, RaffleData>();
      raffleData.forEach(raffle => {
        raffleDataMap.set(raffle.id, raffle);
      });

      // Enhance each launch with additional data
      const enhancedLaunches: EnhancedLaunchData[] = [];

      for (const launch of baseLaunches) {
        try {
          const enhancedLaunch = await this.enhanceLaunchData(launch, raffleDataMap);
          if (enhancedLaunch) {
            enhancedLaunches.push(enhancedLaunch);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to enhance launch ${launch.id}:`, error);
          // Still add the base launch data
          enhancedLaunches.push({
            ...launch,
            isInstantLaunch: launch.launchType === 'instant',
            isRaffleLaunch: launch.launchType === 'raffle',
            isIDOLaunch: launch.launchType === 'ido',
          });
        }
      }

      console.log(`✅ Enhanced ${enhancedLaunches.length} launches`);
      return enhancedLaunches;
    } catch (error) {
      console.error('❌ Error fetching enhanced launches:', error);
      return [];
    }
  }

  /**
   * Fetch launches by type
   */
  async fetchLaunchesByType(type: 'instant' | 'raffle' | 'ido' | 'all'): Promise<EnhancedLaunchData[]> {
    const allLaunches = await this.fetchAllLaunchesEnhanced();
    
    if (type === 'all') {
      return allLaunches;
    }

    return allLaunches.filter(launch => {
      switch (type) {
        case 'instant':
          return launch.isInstantLaunch;
        case 'raffle':
          return launch.isRaffleLaunch;
        case 'ido':
          return launch.isIDOLaunch;
        default:
          return true;
      }
    });
  }

  /**
   * Get launch type summary
   */
  async getLaunchTypeSummary(): Promise<LaunchTypeSummary> {
    const allLaunches = await this.fetchAllLaunchesEnhanced();
    
    return {
      instant: allLaunches.filter(l => l.isInstantLaunch),
      raffle: allLaunches.filter(l => l.isRaffleLaunch),
      ido: allLaunches.filter(l => l.isIDOLaunch),
      total: allLaunches.length
    };
  }

  /**
   * Fetch instant launches specifically
   */
  async fetchInstantLaunches(): Promise<EnhancedLaunchData[]> {
    return this.fetchLaunchesByType('instant');
  }

  /**
   * Fetch raffle launches specifically
   */
  async fetchRaffleLaunches(): Promise<EnhancedLaunchData[]> {
    return this.fetchLaunchesByType('raffle');
  }

  /**
   * Fetch IDO launches specifically
   */
  async fetchIDOLaunches(): Promise<EnhancedLaunchData[]> {
    return this.fetchLaunchesByType('ido');
  }

  /**
   * Enhance individual launch data with additional information
   */
  private async enhanceLaunchData(
    launch: LaunchData, 
    raffleDataMap: Map<string, RaffleData>
  ): Promise<EnhancedLaunchData | null> {
    try {
      const enhanced: EnhancedLaunchData = {
        ...launch,
        isInstantLaunch: launch.launchType === 'instant',
        isRaffleLaunch: launch.launchType === 'raffle',
        isIDOLaunch: launch.launchType === 'ido',
      };

      // Add raffle-specific data if this is a raffle
      if (launch.launchType === 'raffle' && raffleDataMap.has(launch.id)) {
        enhanced.raffleData = raffleDataMap.get(launch.id);
      }

      // Add additional blockchain data
      await this.addBlockchainData(enhanced);

      return enhanced;
    } catch (error) {
      console.error(`❌ Error enhancing launch ${launch.id}:`, error);
      return null;
    }
  }

  /**
   * Add additional blockchain data to launch
   */
  private async addBlockchainData(launch: EnhancedLaunchData): Promise<void> {
    try {
      // Get token mint account info
      const tokenMint = new PublicKey(launch.baseTokenMint);
      const tokenMintInfo = await this.connection.getAccountInfo(tokenMint);
      
      if (tokenMintInfo) {
        // Calculate additional metrics
        launch.tradingVolume = launch.volume24h || 0;
        launch.priceChange24h = launch.priceChange24h || 0;
        launch.holdersCount = launch.participants || 0;
        
        // Determine liquidity pool status
        if (launch.liquidity > 0) {
          launch.liquidityPoolStatus = 'active';
        } else {
          launch.liquidityPoolStatus = 'inactive';
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not fetch additional blockchain data for ${launch.id}:`, error);
    }
  }

  /**
   * Get trending launches (by volume, hype score, etc.)
   */
  async getTrendingLaunches(limit: number = 10): Promise<EnhancedLaunchData[]> {
    const allLaunches = await this.fetchAllLaunchesEnhanced();
    
    return allLaunches
      .sort((a, b) => {
        // Sort by hype score first, then by volume
        if (b.hypeScore !== a.hypeScore) {
          return b.hypeScore - a.hypeScore;
        }
        return (b.volume24h || 0) - (a.volume24h || 0);
      })
      .slice(0, limit);
  }

  /**
   * Get featured launches
   */
  async getFeaturedLaunches(): Promise<EnhancedLaunchData[]> {
    const allLaunches = await this.fetchAllLaunchesEnhanced();
    
    return allLaunches
      .filter(launch => launch.featured)
      .sort((a, b) => b.hypeScore - a.hypeScore);
  }

  /**
   * Search launches by name, symbol, or description
   */
  async searchLaunches(query: string): Promise<EnhancedLaunchData[]> {
    const allLaunches = await this.fetchAllLaunchesEnhanced();
    const lowercaseQuery = query.toLowerCase();
    
    return allLaunches.filter(launch => 
      launch.name.toLowerCase().includes(lowercaseQuery) ||
      launch.symbol.toLowerCase().includes(lowercaseQuery) ||
      launch.description.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Get launches by status
   */
  async getLaunchesByStatus(status: 'upcoming' | 'live' | 'ended'): Promise<EnhancedLaunchData[]> {
    const allLaunches = await this.fetchAllLaunchesEnhanced();
    
    return allLaunches.filter(launch => launch.status === status);
  }

  /**
   * Refresh and clear cache
   */
  clearCache(): void {
    launchDataService.clearCache();
    // Add cache clearing for other services if they have it
  }
}

// Export a default instance
export const enhancedLaunchService = new EnhancedLaunchService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);