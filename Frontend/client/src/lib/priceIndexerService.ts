/**
 * Price Indexer Service
 * 
 * Backend indexer for price data caching and historical data storage
 * Updates price charts in real-time and calculates price changes
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection } from './connection';

export interface PriceDataPoint {
  timestamp: number;
  price: number;
  volume: number;
  liquidity: number;
  marketCap: number;
}

export interface PriceHistoryData {
  tokenMint: string;
  dataPoints: PriceDataPoint[];
  lastUpdated: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
}

export class PriceIndexerService {
  private connection: Connection;
  private cache: Map<string, PriceHistoryData> = new Map();
  private readonly CACHE_DURATION = 60000; // 1 minute
  private readonly MAX_DATA_POINTS = 1000; // Maximum data points to store

  constructor(connection?: Connection) {
    this.connection = connection || getConnection('confirmed');
  }

  /**
   * Index price data for a token
   */
  async indexPriceData(
    tokenMint: string,
    price: number,
    volume: number,
    liquidity: number,
    marketCap: number
  ): Promise<void> {
    try {
      const now = Date.now();
      const cacheKey = tokenMint;

      // Get existing data or create new
      let priceHistory = this.cache.get(cacheKey);
      if (!priceHistory) {
        priceHistory = {
          tokenMint,
          dataPoints: [],
          lastUpdated: now,
          priceChange1h: 0,
          priceChange24h: 0,
          priceChange7d: 0
        };
      }

      // For instant launches, calculate price from bonding curve
      let actualPrice = price;
      try {
        const { launchDataService } = await import('./launchDataService');
        const launch = await launchDataService.getLaunchByTokenMint(tokenMint);
        
        if (launch && launch.launchType === 'instant') {
          // Use bonding curve price for instant launches
          const { tokenSupplyService } = await import('./tokenSupplyService');
          const { bondingCurveService } = await import('./bondingCurveService');
          
          const tokensSold = await tokenSupplyService.getTokensSold(tokenMint);
          const bondingCurveConfig = {
            totalSupply: launch.totalSupply,
            curveType: 'linear' as const,
            // basePrice will be calculated automatically based on supply
          };
          
          // Calculate price from bonding curve
          actualPrice = bondingCurveService.calculatePrice(tokensSold, bondingCurveConfig);
        }
      } catch (error) {
        console.warn('Error calculating bonding curve price for indexer:', error);
        // Fall back to provided price
      }

      // Add new data point with actual price (bonding curve for instant launches)
      const dataPoint: PriceDataPoint = {
        timestamp: now,
        price: actualPrice, // Use bonding curve price for instant launches
        volume,
        liquidity,
        marketCap
      };

      priceHistory.dataPoints.push(dataPoint);

      // Keep only last MAX_DATA_POINTS
      if (priceHistory.dataPoints.length > this.MAX_DATA_POINTS) {
        priceHistory.dataPoints = priceHistory.dataPoints.slice(-this.MAX_DATA_POINTS);
      }

      // Calculate price changes
      priceHistory.priceChange1h = this.calculatePriceChange(priceHistory.dataPoints, 1 * 60 * 60 * 1000);
      priceHistory.priceChange24h = this.calculatePriceChange(priceHistory.dataPoints, 24 * 60 * 60 * 1000);
      priceHistory.priceChange7d = this.calculatePriceChange(priceHistory.dataPoints, 7 * 24 * 60 * 60 * 1000);

      priceHistory.lastUpdated = now;

      // Update cache
      this.cache.set(cacheKey, priceHistory);

      // In production, this would also save to backend database
      await this.saveToBackend(priceHistory);
    } catch (error) {
      console.error('❌ Error indexing price data:', error);
    }
  }

  /**
   * Get price history for a token
   */
  async getPriceHistory(
    tokenMint: string,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<PriceDataPoint[]> {
    try {
      const cacheKey = tokenMint;
      const priceHistory = this.cache.get(cacheKey);

      if (!priceHistory) {
        return [];
      }

      // Calculate time window
      const now = Date.now();
      let timeWindow: number;
      switch (timeframe) {
        case '1h':
          timeWindow = 1 * 60 * 60 * 1000;
          break;
        case '24h':
          timeWindow = 24 * 60 * 60 * 1000;
          break;
        case '7d':
          timeWindow = 7 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          timeWindow = 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          timeWindow = 24 * 60 * 60 * 1000;
      }

      // Filter data points within time window
      const cutoffTime = now - timeWindow;
      return priceHistory.dataPoints.filter(point => point.timestamp >= cutoffTime);
    } catch (error) {
      console.error('❌ Error getting price history:', error);
      return [];
    }
  }

  /**
   * Get price changes for a token
   */
  async getPriceChanges(tokenMint: string): Promise<{
    priceChange1h: number;
    priceChange24h: number;
    priceChange7d: number;
  }> {
    try {
      const cacheKey = tokenMint;
      const priceHistory = this.cache.get(cacheKey);

      if (!priceHistory) {
        return {
          priceChange1h: 0,
          priceChange24h: 0,
          priceChange7d: 0
        };
      }

      return {
        priceChange1h: priceHistory.priceChange1h,
        priceChange24h: priceHistory.priceChange24h,
        priceChange7d: priceHistory.priceChange7d
      };
    } catch (error) {
      console.error('❌ Error getting price changes:', error);
      return {
        priceChange1h: 0,
        priceChange24h: 0,
        priceChange7d: 0
      };
    }
  }

  /**
   * Calculate price change over a time period
   */
  private calculatePriceChange(dataPoints: PriceDataPoint[], timeWindow: number): number {
    if (dataPoints.length < 2) {
      return 0;
    }

    const now = Date.now();
    const cutoffTime = now - timeWindow;

    // Find oldest price within time window
    const oldPricePoint = dataPoints.find(point => point.timestamp >= cutoffTime);
    const currentPrice = dataPoints[dataPoints.length - 1].price;

    if (!oldPricePoint || oldPricePoint.price === 0) {
      return 0;
    }

    const priceChange = ((currentPrice - oldPricePoint.price) / oldPricePoint.price) * 100;
    return priceChange;
  }

  /**
   * Save price history to Supabase
   */
  private async saveToBackend(priceHistory: PriceHistoryData): Promise<void> {
    try {
      const { supabaseCacheService } = await import('./supabaseCacheService');
      const key = `price_history_${priceHistory.tokenMint}`;
      
      // Save to Supabase cache (30 days retention)
      await supabaseCacheService.set(
        key,
        priceHistory,
        'price_data',
        30 * 24 * 60 * 60 * 1000 // 30 days
      );
    } catch (error) {
      console.error('❌ Error saving to backend:', error);
    }
  }

  /**
   * Load price history from Supabase
   */
  async loadPriceHistory(tokenMint: string): Promise<PriceHistoryData | null> {
    try {
      const { supabaseCacheService } = await import('./supabaseCacheService');
      const key = `price_history_${tokenMint}`;
      
      const priceHistory = await supabaseCacheService.get<PriceHistoryData>(
        key,
        'price_data'
      );

      if (priceHistory) {
        this.cache.set(tokenMint, priceHistory);
        return priceHistory;
      }

      return null;
    } catch (error) {
      console.error('❌ Error loading price history:', error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const priceIndexerService = new PriceIndexerService();

