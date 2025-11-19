/**
 * Market Cap Tracking Service
 * 
 * Calculates real-time market cap based on:
 * - Current price (from bonding curve or pool)
 * - Circulating supply (on-chain minted tokens)
 * - Total supply (from launch data)
 */

import { tokenSupplyService } from './tokenSupplyService';
import { liquidityTrackingService } from './liquidityTrackingService';
import { pythPriceService } from './pythPriceService';

export interface MarketCapData {
  tokenMint: string;
  currentPrice: number; // Price in SOL
  currentPriceUSD: number; // Price in USD
  circulatingSupply: number; // Tokens sold/minted
  totalSupply: number; // Total token supply
  marketCap: number; // Market cap in SOL
  marketCapUSD: number; // Market cap in USD
  fullyDilutedMarketCap: number; // Fully diluted market cap in SOL
  fullyDilutedMarketCapUSD: number; // Fully diluted market cap in USD
  timestamp: number;
}

export interface MarketCapHistory {
  tokenMint: string;
  dataPoints: Array<{
    timestamp: number;
    marketCap: number;
    marketCapUSD: number;
    price: number;
    priceUSD: number;
    circulatingSupply: number;
  }>;
}

export class MarketCapService {
  private cache: Map<string, { data: MarketCapData; timestamp: number }> = new Map();
  private historyCache: Map<string, MarketCapHistory> = new Map();
  private readonly CACHE_DURATION = 15000; // 15 seconds
  private readonly MAX_HISTORY_POINTS = 1000;

  /**
   * Get current market cap for a token
   */
  async getMarketCap(tokenMint: string, totalSupply: number): Promise<MarketCapData> {
    const cacheKey = tokenMint;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Get launch data to determine phase and get tokens_sold
      const { launchDataService } = await import('./launchDataService');
      const launch = await launchDataService.getLaunchByTokenMint(tokenMint);
      
      if (!launch) {
        throw new Error('Launch not found');
      }
      
      // Get circulating supply: use tokens_sold from LaunchData (authoritative source)
      let circulatingSupply = 0;
      if (launch.tokensSold !== undefined && launch.tokensSold >= 0) {
        circulatingSupply = launch.tokensSold;
      } else {
        // Fallback: calculate from mint supply (for very old launches)
        circulatingSupply = await tokenSupplyService.getTokensSold(tokenMint);
      }
      
      // Get current price based on graduation status
      let currentPrice = 0;
      const isGraduated = launch.isGraduated === true;
      
      if (launch.launchType === 'instant') {
        if (isGraduated) {
          // GRADUATED: Use AMM pool reserves price (x/y from constant product formula)
          try {
            const { marketDataService } = await import('./marketDataService');
            const ammData = await marketDataService.getAMMAccountData(tokenMint);
            if (ammData && ammData.solReserves > 0 && ammData.tokenReserves > 0) {
              // Constant product formula: Price = SOL_reserves / Token_reserves
              currentPrice = ammData.solReserves / ammData.tokenReserves;
            } else if (ammData && ammData.price > 0) {
              currentPrice = ammData.price;
            }
          } catch (error) {
            console.warn('Error getting AMM price for graduated token, trying liquidity service:', error);
            // Fallback to liquidity service
            const liquidityData = await liquidityTrackingService.getLiquidityData(tokenMint);
            currentPrice = liquidityData.currentPrice || 0;
          }
        } else {
          // BONDING PHASE: Use bonding curve formula P(x) = a*x + b
          const { bondingCurveService } = await import('./bondingCurveService');
          const bondingCurveConfig = {
            totalSupply: launch.totalSupply,
            curveType: 'linear' as const,
            // basePrice will be calculated automatically based on supply
          };
          
          // Calculate price from bonding curve: P(x) = a * x + b
          // x = tokens_sold (circulating supply)
          currentPrice = bondingCurveService.calculatePrice(circulatingSupply, bondingCurveConfig);
        }
      } else {
        // For raffle launches, get price from liquidity service (pool price)
        const liquidityData = await liquidityTrackingService.getLiquidityData(tokenMint);
        currentPrice = liquidityData.currentPrice || 0;
      }
      
      // Get SOL price in USD from Pyth
      const solPriceUSD = await pythPriceService.getSOLPrice();
      const solPrice = solPriceUSD || 150; // Fallback to $150 if Pyth unavailable
      const currentPriceUSD = currentPrice * solPrice;
      
      // Calculate market cap
      const marketCap = currentPrice * circulatingSupply;
      const marketCapUSD = currentPriceUSD * circulatingSupply;
      
      // Calculate fully diluted market cap
      const fullyDilutedMarketCap = currentPrice * totalSupply;
      const fullyDilutedMarketCapUSD = currentPriceUSD * totalSupply;
      
      console.log('📊 Market cap calculation:', {
        tokenMint,
        currentPrice,
        currentPriceUSD,
        circulatingSupply,
        totalSupply,
        marketCap,
        marketCapUSD,
        solPrice
      });
      
      const marketCapData: MarketCapData = {
        tokenMint,
        currentPrice,
        currentPriceUSD,
        circulatingSupply,
        totalSupply,
        marketCap,
        marketCapUSD,
        fullyDilutedMarketCap,
        fullyDilutedMarketCapUSD,
        timestamp: Date.now()
      };

      // Update cache
      this.cache.set(cacheKey, { data: marketCapData, timestamp: Date.now() });
      
      // Update history
      await this.updateHistory(marketCapData);
      
      return marketCapData;
    } catch (error) {
      console.error('Error calculating market cap:', error);
      throw error;
    }
  }

  /**
   * Update market cap history
   */
  private async updateHistory(marketCapData: MarketCapData): Promise<void> {
    try {
      const cacheKey = marketCapData.tokenMint;
      let history = this.historyCache.get(cacheKey);
      
      if (!history) {
        history = {
          tokenMint: marketCapData.tokenMint,
          dataPoints: []
        };
      }

      // Add new data point
      history.dataPoints.push({
        timestamp: marketCapData.timestamp,
        marketCap: marketCapData.marketCap,
        marketCapUSD: marketCapData.marketCapUSD,
        price: marketCapData.currentPrice,
        priceUSD: marketCapData.currentPriceUSD,
        circulatingSupply: marketCapData.circulatingSupply
      });

      // Keep only last N points
      if (history.dataPoints.length > this.MAX_HISTORY_POINTS) {
        history.dataPoints = history.dataPoints.slice(-this.MAX_HISTORY_POINTS);
      }

      this.historyCache.set(cacheKey, history);
      
      // Save to backend (Supabase)
      await this.saveHistoryToBackend(history);
    } catch (error) {
      console.error('Error updating market cap history:', error);
    }
  }

  /**
   * Get market cap history for a token
   */
  async getMarketCapHistory(
    tokenMint: string,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<MarketCapHistory['dataPoints']> {
    try {
      // Try to load from cache first
      let history = this.historyCache.get(tokenMint);
      
      if (!history) {
        // Try to load from backend
        history = await this.loadHistoryFromBackend(tokenMint);
        if (history) {
          this.historyCache.set(tokenMint, history);
        }
      }

      if (!history || history.dataPoints.length === 0) {
        return [];
      }

      // Filter by timeframe
      const now = Date.now();
      const intervals = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const timeWindow = intervals[timeframe];
      const cutoffTime = now - timeWindow;

      return history.dataPoints.filter(point => point.timestamp >= cutoffTime);
    } catch (error) {
      console.error('Error getting market cap history:', error);
      return [];
    }
  }

  /**
   * Save history to backend (Supabase)
   */
  private async saveHistoryToBackend(history: MarketCapHistory): Promise<void> {
    try {
      const { supabaseCacheService } = await import('./supabaseCacheService');
      const key = `marketcap_history_${history.tokenMint}`;
      
      await supabaseCacheService.set(
        key,
        history,
        'market_data',
        30 * 24 * 60 * 60 * 1000 // 30 days retention
      );
    } catch (error) {
      console.error('Error saving market cap history to backend:', error);
    }
  }

  /**
   * Load history from backend (Supabase)
   */
  private async loadHistoryFromBackend(tokenMint: string): Promise<MarketCapHistory | null> {
    try {
      const { supabaseCacheService } = await import('./supabaseCacheService');
      const key = `marketcap_history_${tokenMint}`;
      
      const history = await supabaseCacheService.get<MarketCapHistory>(
        key,
        'market_data'
      );

      return history;
    } catch (error) {
      console.error('Error loading market cap history from backend:', error);
      return null;
    }
  }

  /**
   * Get market cap change percentage over a period
   */
  async getMarketCapChange(
    tokenMint: string,
    period: '1h' | '24h' | '7d' = '24h'
  ): Promise<number> {
    try {
      const history = await this.getMarketCapHistory(tokenMint, period);
      
      if (history.length < 2) {
        return 0;
      }

      const oldest = history[0];
      const newest = history[history.length - 1];

      if (oldest.marketCap === 0) {
        return 0;
      }

      return ((newest.marketCap - oldest.marketCap) / oldest.marketCap) * 100;
    } catch (error) {
      console.error('Error calculating market cap change:', error);
      return 0;
    }
  }

  /**
   * Clear cache for a token
   */
  clearCache(tokenMint: string): void {
    this.cache.delete(tokenMint);
    this.historyCache.delete(tokenMint);
  }
}

export const marketCapService = new MarketCapService();

