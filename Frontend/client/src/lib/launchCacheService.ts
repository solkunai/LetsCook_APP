/**
 * Launch Cache Service
 * 
 * Caches launch data, market data, and bonding curve data to reduce RPC calls
 * Uses Supabase for persistent storage with in-memory cache for fast access
 */

import { getSupabaseClient } from './supabase';
import { supabaseCacheService } from './supabaseCacheService';
import type { LaunchData } from './launchDataService';
import type { MarketData } from './marketDataService';

export interface CachedLaunchData {
  launch: LaunchData;
  marketData?: MarketData;
  bondingCurveData?: {
    solReserves: number;
    tokenReserves: number;
    initialPrice: number;
    tokensSold: number;
    currentBondingPrice: number;
  };
  liquidityLockInfo?: {
    isLocked: boolean;
    lockAddress?: string;
    unlockDate?: Date;
    lockDuration?: number;
    lockedAmount?: number;
  };
  lastUpdated: number;
}

export class LaunchCacheService {
  private memoryCache: Map<string, CachedLaunchData> = new Map();
  private readonly LAUNCH_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
  private readonly MARKET_DATA_CACHE_DURATION = 30 * 1000; // 30 seconds
  private readonly BONDING_CURVE_CACHE_DURATION = 10 * 1000; // 10 seconds

  /**
   * Get cached launch data
   */
  async getLaunch(launchId: string): Promise<CachedLaunchData | null> {
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(launchId);
      if (memoryEntry && Date.now() - memoryEntry.lastUpdated < this.LAUNCH_CACHE_DURATION) {
        return memoryEntry;
      }

      // Check Supabase cache
      const cached = await supabaseCacheService.get<CachedLaunchData>(
        `launch_${launchId}`,
        'launch_data'
      );

      if (cached) {
        // Update memory cache
        this.memoryCache.set(launchId, cached);
        return cached;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting cached launch:', error);
      return null;
    }
  }

  /**
   * Cache launch data
   */
  async cacheLaunch(
    launchId: string,
    launch: LaunchData,
    marketData?: MarketData,
    bondingCurveData?: {
      solReserves: number;
      tokenReserves: number;
      initialPrice: number;
      tokensSold: number;
      currentBondingPrice: number;
    },
    liquidityLockInfo?: {
      isLocked: boolean;
      lockAddress?: string;
      unlockDate?: Date;
      lockDuration?: number;
      lockedAmount?: number;
    }
  ): Promise<void> {
    try {
      const cachedData: CachedLaunchData = {
        launch,
        marketData,
        bondingCurveData,
        liquidityLockInfo,
        lastUpdated: Date.now()
      };

      // Update memory cache
      this.memoryCache.set(launchId, cachedData);

      // Save to Supabase (2 minutes cache)
      await supabaseCacheService.set(
        `launch_${launchId}`,
        cachedData,
        'launch_data',
        this.LAUNCH_CACHE_DURATION
      );
    } catch (error) {
      console.error('❌ Error caching launch:', error);
    }
  }

  /**
   * Get cached market data
   */
  async getMarketData(tokenMint: string): Promise<MarketData | null> {
    try {
      return await supabaseCacheService.get<MarketData>(
        `market_${tokenMint}`,
        'market_data'
      );
    } catch (error) {
      console.error('❌ Error getting cached market data:', error);
      return null;
    }
  }

  /**
   * Cache market data
   */
  async cacheMarketData(tokenMint: string, marketData: MarketData): Promise<void> {
    try {
      await supabaseCacheService.set(
        `market_${tokenMint}`,
        marketData,
        'market_data',
        this.MARKET_DATA_CACHE_DURATION
      );
    } catch (error) {
      console.error('❌ Error caching market data:', error);
    }
  }

  /**
   * Get cached bonding curve data
   */
  async getBondingCurveData(tokenMint: string): Promise<{
    solReserves: number;
    tokenReserves: number;
    initialPrice: number;
    tokensSold: number;
    currentBondingPrice: number;
  } | null> {
    try {
      return await supabaseCacheService.get<{
        solReserves: number;
        tokenReserves: number;
        initialPrice: number;
        tokensSold: number;
        currentBondingPrice: number;
      }>(
        `bonding_curve_${tokenMint}`,
        'bonding_curve'
      );
    } catch (error) {
      console.error('❌ Error getting cached bonding curve data:', error);
      return null;
    }
  }

  /**
   * Cache bonding curve data
   */
  async cacheBondingCurveData(
    tokenMint: string,
    data: {
      solReserves: number;
      tokenReserves: number;
      initialPrice: number;
      tokensSold: number;
      currentBondingPrice: number;
    }
  ): Promise<void> {
    try {
      await supabaseCacheService.set(
        `bonding_curve_${tokenMint}`,
        data,
        'bonding_curve',
        this.BONDING_CURVE_CACHE_DURATION
      );
    } catch (error) {
      console.error('❌ Error caching bonding curve data:', error);
    }
  }

  /**
   * Invalidate cache for a launch
   */
  async invalidateLaunch(launchId: string): Promise<void> {
    try {
      this.memoryCache.delete(launchId);
      await supabaseCacheService.delete(`launch_${launchId}`, 'launch_data');
    } catch (error) {
      console.error('❌ Error invalidating launch cache:', error);
    }
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    try {
      this.memoryCache.clear();
      await supabaseCacheService.clearType('launch_data');
      await supabaseCacheService.clearType('market_data');
      await supabaseCacheService.clearType('bonding_curve');
    } catch (error) {
      console.error('❌ Error clearing caches:', error);
    }
  }
}

export const launchCacheService = new LaunchCacheService();

