/**
 * Pyth Network Price Feed Service
 * 
 * Integrates with Pyth Network for accurate price feeds
 * Falls back to on-chain pool reserves when Pyth doesn't have the pair
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection } from './connection';

export interface PythPriceData {
  price: number;
  confidence: number;
  timestamp: number;
  symbol: string;
  exponent: number;
}

export class PythPriceService {
  private connection: Connection;
  private readonly PYTH_PROGRAM_ID = new PublicKey('FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH'); // Pyth devnet
  private cache: Map<string, { data: PythPriceData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5000; // 5 seconds

  constructor(connection?: Connection) {
    this.connection = connection || getConnection('confirmed');
  }

  /**
   * Get SOL price from Pyth Network
   */
  async getSOLPrice(): Promise<number | null> {
    try {
      // Pyth SOL/USD price feed account (devnet)
      const SOL_PRICE_FEED = new PublicKey('J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBebebcyiwa'); // Example devnet feed
      
      const accountInfo = await this.connection.getAccountInfo(SOL_PRICE_FEED);
      if (!accountInfo) {
        console.warn('⚠️ Pyth SOL price feed not found');
        return null;
      }

      // Parse Pyth price data
      // Pyth price structure: price (i64), confidence (u64), exponent (i32), publish_time (i64)
      const price = accountInfo.data.readBigInt64LE(0);
      const exponent = accountInfo.data.readInt32LE(16);
      
      // Convert to number: price * 10^exponent
      const solPrice = Number(price) * Math.pow(10, exponent);
      
      return Math.abs(solPrice); // Ensure positive
    } catch (error) {
      console.error('❌ Error fetching SOL price from Pyth:', error);
      return null;
    }
  }

  /**
   * Get token price from Pyth (if available) or compute from pool reserves
   */
  async getTokenPrice(
    tokenMint: string,
    solReserves: number,
    tokenReserves: number
  ): Promise<number> {
    const cacheKey = `price_${tokenMint}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data.price;
    }

    try {
      // Try to get SOL price from Pyth
      const solPrice = await this.getSOLPrice();
      
      if (!solPrice) {
        // Fallback: Use SOL = $100 as default if Pyth unavailable
        console.warn('⚠️ Using fallback SOL price: $100');
        const fallbackSolPrice = 100;
        const tokenPrice = tokenReserves > 0 
          ? (solReserves / tokenReserves) * fallbackSolPrice
          : 0;
        
        this.cache.set(cacheKey, {
          data: { price: tokenPrice, confidence: 0, timestamp: Date.now(), symbol: 'TOKEN', exponent: -9 },
          timestamp: Date.now()
        });
        
        return tokenPrice;
      }

      // Compute token price: (SOL_in_pool / token_in_pool) * SOL_Pyth_price
      const tokenPrice = tokenReserves > 0 
        ? (solReserves / tokenReserves) * solPrice
        : 0;

      this.cache.set(cacheKey, {
        data: { 
          price: tokenPrice, 
          confidence: 0.95, // High confidence when using Pyth
          timestamp: Date.now(), 
          symbol: tokenMint.slice(0, 4), 
          exponent: -9 
        },
        timestamp: Date.now()
      });

      return tokenPrice;
    } catch (error) {
      console.error('❌ Error computing token price:', error);
      // Fallback to simple calculation
      return tokenReserves > 0 ? solReserves / tokenReserves : 0;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const pythPriceService = new PythPriceService();

