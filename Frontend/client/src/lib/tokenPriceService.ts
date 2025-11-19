/**
 * Token Price Service
 * 
 * Unified service to get the correct token price based on launch type and status
 * - Instant launches: Uses bonding curve price (from token supply)
 * - Raffle launches (pre-graduation): Uses ticket price
 * - Raffle launches (post-graduation): Uses AMM pool price
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection } from './connection';
import { tokenSupplyService } from './tokenSupplyService';
import { bondingCurveService } from './bondingCurveService';
import { marketDataService } from './marketDataService';
import { raydiumService } from './raydiumService';
import type { LaunchData } from './launchDataService';

export interface TokenPriceInfo {
  price: number;
  priceSource: 'bonding_curve' | 'amm_pool' | 'ticket_price' | 'market_data';
  dexProvider?: 'cook' | 'raydium';
  poolAddress?: string;
  isTradable: boolean;
}

export class TokenPriceService {
  private connection: Connection;

  constructor(connection?: Connection) {
    this.connection = connection || getConnection('confirmed');
  }

  /**
   * Get the correct token price based on launch type and status
   */
  async getTokenPrice(launch: LaunchData): Promise<TokenPriceInfo> {
    try {
      // For instant launches, use bonding curve price
      if (launch.launchType === 'instant') {
        return await this.getBondingCurvePrice(launch);
      }

      // For raffle launches, check if they've graduated to trading
      if (launch.launchType === 'raffle') {
        // Check if launch is tradable (graduated)
        const isTradable = await this.checkIfTradable(launch.baseTokenMint);
        
        if (isTradable) {
          // Raffle has graduated - use AMM pool price
          return await this.getAMMPoolPrice(launch);
        } else {
          // Raffle hasn't graduated yet - use ticket price
          return {
            price: launch.ticketPrice || 0,
            priceSource: 'ticket_price',
            isTradable: false
          };
        }
      }

      // Fallback to market data price
      return await this.getMarketDataPrice(launch);
    } catch (error) {
      console.error('Error getting token price:', error);
      // Fallback to ticket price or 0
      return {
        price: launch.ticketPrice || launch.currentPrice || 0,
        priceSource: 'ticket_price',
        isTradable: false
      };
    }
  }

  /**
   * Get bonding curve price for instant launches
   */
  private async getBondingCurvePrice(launch: LaunchData): Promise<TokenPriceInfo> {
    try {
      // Get actual tokens sold from on-chain mint supply
      const tokensSold = await tokenSupplyService.getTokensSold(launch.baseTokenMint);
      
      // Calculate current price using bonding curve formula
      const bondingCurveConfig = {
        totalSupply: launch.totalSupply,
        curveType: 'linear' as const,
        // basePrice will be calculated automatically based on supply (higher supply = lower initial price)
      };
      
      // Calculate price from bonding curve: P(x) = a * x + b
      const price = bondingCurveService.calculatePrice(tokensSold, bondingCurveConfig);
      
      return {
        price,
        priceSource: 'bonding_curve',
        isTradable: true
      };
    } catch (error) {
      console.error('Error getting bonding curve price:', error);
      throw error;
    }
  }

  /**
   * Get AMM pool price for graduated raffle launches
   */
  private async getAMMPoolPrice(launch: LaunchData): Promise<TokenPriceInfo> {
    try {
      const tokenMint = new PublicKey(launch.baseTokenMint);
      const dexProvider = launch.dexProvider === 1 ? 'raydium' : 'cook';
      
      if (dexProvider === 'raydium') {
        // Try to get price from Raydium pool
        const price = await raydiumService.getTokenPrice(tokenMint);
        if (price !== null && price > 0) {
          const poolAddress = await raydiumService.findPool(
            tokenMint,
            new PublicKey('So11111111111111111111111111111111111111112')
          );
          
          return {
            price,
            priceSource: 'amm_pool',
            dexProvider: 'raydium',
            poolAddress: poolAddress?.toBase58(),
            isTradable: true
          };
        }
      }
      
      // Fallback to Cook DEX or market data
      const marketData = await marketDataService.getMarketData(launch.baseTokenMint, launch.totalSupply);
      
      return {
        price: marketData.price,
        priceSource: 'amm_pool',
        dexProvider: 'cook',
        isTradable: true
      };
    } catch (error) {
      console.error('Error getting AMM pool price:', error);
      throw error;
    }
  }

  /**
   * Get price from market data service (fallback)
   */
  private async getMarketDataPrice(launch: LaunchData): Promise<TokenPriceInfo> {
    try {
      const marketData = await marketDataService.getMarketData(launch.baseTokenMint, launch.totalSupply);
      return {
        price: marketData.price,
        priceSource: 'market_data',
        isTradable: true
      };
    } catch (error) {
      console.error('Error getting market data price:', error);
      throw error;
    }
  }

  /**
   * Check if a token is tradable (raffle has graduated)
   */
  private async checkIfTradable(tokenMint: string): Promise<boolean> {
    try {
      // Check if there's an AMM pool for this token
      // If pool exists, token is tradable
      const { marketDataService: mds } = await import('./marketDataService');
      const ammData = await (mds as any).getAMMAccountData(tokenMint);
      
      return ammData !== null && ammData.solReserves > 0;
    } catch (error) {
      console.warn('Error checking if tradable:', error);
      return false;
    }
  }
}

export const tokenPriceService = new TokenPriceService();

