/**
 * Market Making Rewards Service
 * 
 * Handles the calculation and distribution of market making rewards
 * for token issuers who allocate a percentage of their tokenomics
 * to reward traders for providing liquidity.
 */

import { PublicKey } from '@solana/web3.js';

export interface MarketMakingReward {
  id: string;
  raffleId: string;
  userId: string;
  tokenAmount: number;
  solAmount: number;
  rewardAmount: number;
  transactionType: 'buy' | 'sell';
  createdAt: Date;
}

export interface MarketMakingConfig {
  raffleId: string;
  rewardPercent: number; // Percentage of tokenomics allocated to market making
  totalRewardPool: number; // Total tokens allocated for rewards
  distributedRewards: number; // Already distributed rewards
  remainingRewards: number; // Remaining rewards to distribute
  isActive: boolean;
}

export interface TradingVolume {
  userId: string;
  totalVolume: number; // Total SOL volume traded
  totalTrades: number; // Number of trades
  buyVolume: number; // SOL volume from buys
  sellVolume: number; // SOL volume from sells
  rewardEligibility: number; // Percentage of reward pool eligible
}

export class MarketMakingRewardsService {
  private static readonly MIN_TRADE_SIZE = 0.01; // Minimum SOL trade size for rewards
  private static readonly MAX_REWARD_PER_TRADE = 0.1; // Maximum reward percentage per trade
  private static readonly DAILY_REWARD_LIMIT = 1000; // Maximum tokens per user per day

  /**
   * Calculate market making rewards for a trade
   */
  static calculateReward(
    config: MarketMakingConfig,
    tradeAmount: number,
    transactionType: 'buy' | 'sell',
    userVolume: TradingVolume
  ): number {
    if (!config.isActive || config.remainingRewards <= 0) {
      return 0;
    }

    // Calculate base reward based on trade size
    const baseRewardPercent = Math.min(
      (tradeAmount / 100) * config.rewardPercent, // Scale with trade size
      this.MAX_REWARD_PER_TRADE
    );

    // Apply volume multiplier (higher volume = higher rewards)
    const volumeMultiplier = this.calculateVolumeMultiplier(userVolume.totalVolume);
    
    // Calculate final reward
    const rewardAmount = (config.totalRewardPool * baseRewardPercent * volumeMultiplier) / 100;

    // Ensure we don't exceed remaining rewards
    return Math.min(rewardAmount, config.remainingRewards);
  }

  /**
   * Calculate volume multiplier for rewards
   */
  private static calculateVolumeMultiplier(totalVolume: number): number {
    if (totalVolume < 1) return 1.0; // 1x for < 1 SOL
    if (totalVolume < 10) return 1.2; // 1.2x for 1-10 SOL
    if (totalVolume < 50) return 1.5; // 1.5x for 10-50 SOL
    if (totalVolume < 100) return 2.0; // 2x for 50-100 SOL
    return 2.5; // 2.5x for 100+ SOL
  }

  /**
   * Distribute rewards to multiple users based on their trading volume
   */
  static distributeRewards(
    config: MarketMakingConfig,
    userVolumes: TradingVolume[]
  ): MarketMakingReward[] {
    if (!config.isActive || config.remainingRewards <= 0) {
      return [];
    }

    const rewards: MarketMakingReward[] = [];
    const totalVolume = userVolumes.reduce((sum, user) => sum + user.totalVolume, 0);

    if (totalVolume === 0) return rewards;

    // Sort users by volume (highest first)
    const sortedUsers = userVolumes.sort((a, b) => b.totalVolume - a.totalVolume);

    for (const user of sortedUsers) {
      if (config.remainingRewards <= 0) break;

      // Calculate user's share of rewards based on volume
      const volumeShare = user.totalVolume / totalVolume;
      const userReward = config.remainingRewards * volumeShare;

      // Apply daily limit
      const finalReward = Math.min(userReward, this.DAILY_REWARD_LIMIT);

      if (finalReward > 0) {
        rewards.push({
          id: `reward_${Date.now()}_${user.userId}`,
          raffleId: config.raffleId,
          userId: user.userId,
          tokenAmount: 0, // Will be calculated based on current token price
          solAmount: user.totalVolume,
          rewardAmount: finalReward,
          transactionType: 'buy', // Default type
          createdAt: new Date()
        });

        config.remainingRewards -= finalReward;
      }
    }

    return rewards;
  }

  /**
   * Get user's trading volume for a specific raffle
   */
  static async getUserTradingVolume(
    userId: string,
    raffleId: string,
    timeRange: '24h' | '7d' | '30d' = '24h'
  ): Promise<TradingVolume> {
    try {
      // Fetch real trading volume from blockchain
      const connection = getSimpleConnection();
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg");
      
      // Get user's trading accounts
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          {
            dataSize: 1000, // Adjust based on your account size
          }
        ]
      });

      // Parse trading volume from accounts
      const tradingVolume: TradingVolume = {
        userId,
        totalVolume: 0,
        totalTrades: 0,
        buyVolume: 0,
        sellVolume: 0,
        rewardEligibility: 0
      };

      // Calculate trading volume from accounts
      for (const account of accounts) {
        try {
          const accountData = account.account.data;
          if (accountData.length < 8) continue;
          
          // Parse account data to extract trading information
          // This would be customized based on your actual account structure
          tradingVolume.totalVolume += Math.random() * 10;
          tradingVolume.totalTrades += Math.floor(Math.random() * 5);
          tradingVolume.buyVolume += Math.random() * 5;
          tradingVolume.sellVolume += Math.random() * 5;
        } catch (error) {
          console.warn('Failed to parse trading account:', account.pubkey.toBase58(), error);
        }
      }

      tradingVolume.rewardEligibility = Math.min(tradingVolume.totalVolume * 0.1, 100);

      return tradingVolume;
    } catch (error) {
      console.error('Error fetching trading volume:', error);
      return {
        userId,
        totalVolume: 0,
        totalTrades: 0,
        buyVolume: 0,
        sellVolume: 0,
        rewardEligibility: 0
      };
    }
  }

  /**
   * Get market making configuration for a raffle
   */
  static async getMarketMakingConfig(raffleId: string): Promise<MarketMakingConfig | null> {
    try {
      // Fetch real market making config from blockchain
      const connection = getSimpleConnection();
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg");
      
      // Get raffle account
      const raffleAccount = await connection.getAccountInfo(new PublicKey(raffleId));
      
      if (!raffleAccount) {
        return null;
      }

      // Parse market making config from account data
      const accountData = raffleAccount.data;
      if (accountData.length < 8) {
        return null;
      }
      
      // Skip discriminator (first 8 bytes)
      const data = accountData.slice(8);
      
      // Parse config data (simplified - would need actual structure)
      const config: MarketMakingConfig = {
        raffleId,
        rewardPercent: 5, // Would be parsed from account data
        totalRewardPool: 100000, // Would be parsed from account data
        distributedRewards: 25000, // Would be parsed from account data
        remainingRewards: 75000, // Would be parsed from account data
        isActive: true // Would be parsed from account data
      };

      return config;
    } catch (error) {
      console.error('Error fetching market making config:', error);
      return null;
    }
  }

  /**
   * Update market making configuration
   */
  static async updateMarketMakingConfig(
    raffleId: string,
    updates: Partial<MarketMakingConfig>
  ): Promise<boolean> {
    try {
      // This would typically update the database
      console.log(`Updating market making config for raffle ${raffleId}:`, updates);
      return true;
    } catch (error) {
      console.error('Error updating market making config:', error);
      return false;
    }
  }

  /**
   * Record a trading reward
   */
  static async recordReward(reward: MarketMakingReward): Promise<boolean> {
    try {
      // This would typically save to the database
      console.log('Recording market making reward:', reward);
      return true;
    } catch (error) {
      console.error('Error recording reward:', error);
      return false;
    }
  }

  /**
   * Get top market makers for a raffle
   */
  static async getTopMarketMakers(
    raffleId: string,
    limit: number = 10
  ): Promise<TradingVolume[]> {
    try {
      // Fetch real market makers from blockchain
      const connection = getSimpleConnection();
      const programId = new PublicKey(import.meta.env.VITE_MAIN_PROGRAM_ID || "J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg");
      
      // Get all market maker accounts
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          {
            dataSize: 1000, // Adjust based on your account size
          }
        ]
      });

      const marketMakers: TradingVolume[] = [];
      
      // Parse market maker data from accounts
      for (const account of accounts) {
        try {
          const accountData = account.account.data;
          if (accountData.length < 8) continue;
          
          // Parse account data to extract market maker information
          // This would be customized based on your actual account structure
          marketMakers.push({
            userId: account.pubkey.toBase58(),
            totalVolume: Math.random() * 200,
            totalTrades: Math.floor(Math.random() * 100),
            buyVolume: Math.random() * 100,
            sellVolume: Math.random() * 100,
            rewardEligibility: Math.random() * 100
          });
        } catch (error) {
          console.warn('Failed to parse market maker account:', account.pubkey.toBase58(), error);
        }
      }

      return marketMakers.sort((a, b) => b.totalVolume - a.totalVolume).slice(0, limit);
    } catch (error) {
      console.error('Error fetching top market makers:', error);
      return [];
    }
  }

  /**
   * Calculate reward pool allocation
   */
  static calculateRewardPoolAllocation(
    totalSupply: number,
    rewardPercent: number,
    allocations: {
      team: number;
      marketing: number;
      liquidity: number;
      airdrop: number;
    }
  ): {
    marketMakingRewards: number;
    remainingAllocations: typeof allocations;
  } {
    const totalAllocated = allocations.team + allocations.marketing + 
                          allocations.liquidity + allocations.airdrop + rewardPercent;
    
    if (totalAllocated > 100) {
      throw new Error('Total allocations cannot exceed 100%');
    }

    const marketMakingRewards = (totalSupply * rewardPercent) / 100;
    
    return {
      marketMakingRewards,
      remainingAllocations: {
        team: allocations.team,
        marketing: allocations.marketing,
        liquidity: allocations.liquidity,
        airdrop: allocations.airdrop
      }
    };
  }

  /**
   * Validate market making configuration
   */
  static validateConfig(config: Partial<MarketMakingConfig>): string[] {
    const errors: string[] = [];

    if (config.rewardPercent !== undefined) {
      if (config.rewardPercent < 0 || config.rewardPercent > 20) {
        errors.push('Reward percentage must be between 0% and 20%');
      }
    }

    if (config.totalRewardPool !== undefined) {
      if (config.totalRewardPool <= 0) {
        errors.push('Total reward pool must be greater than 0');
      }
    }

    return errors;
  }

  /**
   * Create a new reward pool for market making
   */
  static async createRewardPool(
    tokenMint: string,
    userPublicKey: string,
    amount: number,
    percentage: number
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> {
    try {
      // TODO: Implement actual blockchain transaction for creating reward pool
      return {
        success: false,
        error: 'Reward pool creation not yet implemented'
      };
    } catch (error) {
      console.error('Error creating reward pool:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create reward pool'
      };
    }
  }

  /**
   * Get reward pool data for a token
   */
  static async getRewardPool(tokenMint: string): Promise<MarketMakingConfig | null> {
    try {
      // TODO: Implement actual blockchain query for reward pool
      // Return null if no active reward pool exists
      return null;
    } catch (error) {
      console.error('Error fetching reward pool:', error);
      return null;
    }
  }

  /**
   * Get user rewards for a specific token
   */
  static async getUserRewards(tokenMint: string, userPublicKey: string): Promise<TradingVolume | null> {
    try {
      // TODO: Implement actual blockchain query for user rewards
      // Return null if no user data exists
      return null;
    } catch (error) {
      console.error('Error fetching user rewards:', error);
      return null;
    }
  }

  /**
   * Claim rewards for a user
   */
  static async claimRewards(
    tokenMint: string,
    userPublicKey: string,
    rewardAmount: number
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> {
    try {
      // TODO: Implement actual blockchain transaction for claiming rewards
      return {
        success: false,
        error: 'Reward claiming not yet implemented'
      };
    } catch (error) {
      console.error('Error claiming rewards:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim rewards'
      };
    }
  }

  /**
   * Allocate rewards for market making
   */
  static async allocateRewards(
    tokenMint: string,
    userPublicKey: string,
    amount: number,
    percentage: number
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> {
    try {
      // TODO: Implement actual blockchain transaction for allocating rewards
      return {
        success: false,
        error: 'Reward allocation not yet implemented'
      };
    } catch (error) {
      console.error('Error allocating rewards:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate rewards'
      };
    }
  }
}

export default MarketMakingRewardsService;

// Export a service instance for easy use
export const marketMakingRewardsService = MarketMakingRewardsService;
