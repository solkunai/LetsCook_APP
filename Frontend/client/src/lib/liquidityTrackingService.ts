/**
 * Liquidity Tracking Service
 * 
 * Tracks liquidity for both initial liquidity (from creators) and DEX pool liquidity
 * Supports both Cook DEX and Raydium pools
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getConnection } from './connection';
import { PROGRAM_ID } from './nativeProgram';

export interface TokenLiquidity {
  initialSol: number;        // SOL deposited by creator (optional)
  initialTokens: number;     // Tokens deposited alongside SOL (optional)
  lockExpiry?: number;       // Timestamp when lock expires (optional)
  isLocked: boolean;         // Whether liquidity is currently locked
}

export interface PoolLiquidity {
  tokensInPool: number;      // Tokens in the pool
  solInPool: number;         // SOL in the pool
  totalLiquidity: number;    // Total liquidity value (SOL + tokens * price)
  poolAddress?: string;      // Pool address (if available)
  dexProvider: 'cook' | 'raydium' | 'none';
  lockExpiry?: number;       // Timestamp when lock expires (if locked)
  isLocked: boolean;         // Whether pool liquidity is locked
}

export interface LiquidityData {
  tokenMint: string;
  initialLiquidity: TokenLiquidity;
  poolLiquidity: PoolLiquidity;
  currentPrice: number;      // Current token price
  totalLiquidity: number;    // Combined initial + pool liquidity
}

export class LiquidityTrackingService {
  private connection: Connection;
  private cache: Map<string, { data: LiquidityData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(connection?: Connection) {
    this.connection = connection || getConnection('confirmed');
  }

  /**
   * Get comprehensive liquidity data for a token
   * 
   * For bonding curve launches:
   * - If no initial liquidity: Pool liquidity comes from trading activity
   * - Each purchase adds SOL to the pool, creating liquidity
   * - Total liquidity = Initial liquidity (if any) + Pool liquidity (from trades)
   * 
   * For traditional launches:
   * - Initial liquidity is provided by creator
   * - Pool liquidity is additional liquidity added later
   * - Total liquidity = Initial + Pool
   */
  async getLiquidityData(
    tokenMint: string,
    dexProvider?: 'cook' | 'raydium'
  ): Promise<LiquidityData> {
    const cacheKey = `${tokenMint}_${dexProvider || 'auto'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Get initial liquidity (from launch data - optional)
      // This is only present if creator provided initial liquidity
      const initialLiquidity = await this.getInitialLiquidity(tokenMint);
      
      // Get pool liquidity (from DEX)
      // For bonding curves without initial liquidity, this is the primary source
      // It grows with each trade as SOL accumulates in the pool
      let poolLiquidity: PoolLiquidity;
      try {
        poolLiquidity = await this.getPoolLiquidity(tokenMint, dexProvider);
      } catch (error) {
        // If pool doesn't exist yet (new launch, no trades), return zero liquidity
        console.log('Pool not initialized yet, using zero liquidity');
        poolLiquidity = {
          tokensInPool: 0,
          solInPool: 0,
          totalLiquidity: 0,
          dexProvider: 'none',
          isLocked: false
        };
      }
      
      // Get current price (from bonding curve or pool)
      const currentPrice = await this.getCurrentPrice(tokenMint);
      
      // Calculate total liquidity
      // For bonding curves: Pool liquidity = SOL from trades × 2 (50/50 pool)
      // If initial liquidity was provided, add it to pool liquidity
      const initialLiquidityValue = initialLiquidity.initialSol + 
        (initialLiquidity.initialTokens * currentPrice);
      
      const totalLiquidity = initialLiquidityValue + poolLiquidity.totalLiquidity;

      console.log('📊 Total Liquidity Calculation:', {
        tokenMint,
        initialLiquidityValue,
        poolLiquidity: poolLiquidity.totalLiquidity,
        totalLiquidity,
        solInPool: poolLiquidity.solInPool,
        tokensInPool: poolLiquidity.tokensInPool
      });

      const liquidityData: LiquidityData = {
        tokenMint,
        initialLiquidity,
        poolLiquidity,
        currentPrice,
        totalLiquidity
      };

      this.cache.set(cacheKey, { data: liquidityData, timestamp: Date.now() });
      return liquidityData;
    } catch (error) {
      console.error('Error getting liquidity data:', error);
      // Return zero liquidity on error
      return {
        tokenMint,
        initialLiquidity: {
          initialSol: 0,
          initialTokens: 0,
          isLocked: false
        },
        poolLiquidity: {
          tokensInPool: 0,
          solInPool: 0,
          totalLiquidity: 0,
          dexProvider: 'none',
          isLocked: false
        },
        currentPrice: 0,
        totalLiquidity: 0
      };
    }
  }

  /**
   * Get initial liquidity (optional SOL/tokens from creator)
   */
  private async getInitialLiquidity(tokenMint: string): Promise<TokenLiquidity> {
    try {
      // Check for initial liquidity in launch data or events
      const { onChainEventsService } = await import('./onChainEventsService');
      const events = await onChainEventsService.loadEvents(tokenMint, 'initial_liquidity');
      
      if (events && events.length > 0) {
        const latestEvent = events[events.length - 1];
        const lockExpiry = latestEvent.lockExpiry 
          ? new Date(latestEvent.lockExpiry * 1000).getTime()
          : undefined;
        
        return {
          initialSol: latestEvent.solAmount || 0,
          initialTokens: latestEvent.tokenAmount || 0,
          lockExpiry,
          isLocked: lockExpiry ? Date.now() < lockExpiry : false
        };
      }

      // Default: no initial liquidity
      return {
        initialSol: 0,
        initialTokens: 0,
        isLocked: false
      };
    } catch (error) {
      console.warn('Error getting initial liquidity:', error);
      return {
        initialSol: 0,
        initialTokens: 0,
        isLocked: false
      };
    }
  }

  /**
   * Get pool liquidity (from Cook DEX or Raydium)
   * 
   * For bonding curve launches without initial liquidity:
   * - Liquidity is created dynamically as tokens are bought
   * - SOL accumulates in the AMM's quote vault with each purchase
   * - Tokens are distributed from the base vault
   * - Total liquidity = SOL reserves × 2 (for 50/50 pool)
   * - Or: Total liquidity = SOL reserves + (Token reserves × current price)
   */
  async getPoolLiquidity(
    tokenMint: string,
    dexProvider?: 'cook' | 'raydium'
  ): Promise<PoolLiquidity> {
    try {
      const tokenMintKey = new PublicKey(tokenMint);
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

      // Try Cook DEX first (if not specified or cook)
      // This handles both initial liquidity and bonding curve liquidity
      if (!dexProvider || dexProvider === 'cook') {
        try {
          const cookLiquidity = await this.getCookDEXLiquidity(tokenMintKey);
          
          // For bonding curves, even small amounts count as liquidity
          // The pool might have reserves even if they're small (from first purchase)
          if (cookLiquidity.solInPool >= 0 || cookLiquidity.tokensInPool >= 0) {
            // If we have valid data (even if zero), return it
            // Zero liquidity means pool exists but hasn't been traded yet
            return cookLiquidity;
          }
        } catch (error) {
          // If AMM account doesn't exist, pool hasn't been initialized yet
          // This is expected for new launches before first trade
          console.log('Cook DEX pool not initialized yet (this is normal for new launches):', error.message);
        }
      }

      // Try Raydium
      if (!dexProvider || dexProvider === 'raydium') {
        try {
          const raydiumLiquidity = await this.getRaydiumLiquidity(tokenMintKey, WSOL_MINT);
          if (raydiumLiquidity.tokensInPool > 0 || raydiumLiquidity.solInPool > 0) {
            return raydiumLiquidity;
          }
        } catch (error) {
          console.warn('Raydium pool not found:', error);
        }
      }

      // No pool found or pool exists but has zero liquidity
      // This is normal for new launches before first trade
      return {
        tokensInPool: 0,
        solInPool: 0,
        totalLiquidity: 0,
        dexProvider: 'none',
        isLocked: false
      };
    } catch (error) {
      console.error('Error getting pool liquidity:', error);
      return {
        tokensInPool: 0,
        solInPool: 0,
        totalLiquidity: 0,
        dexProvider: 'none',
        isLocked: false
      };
    }
  }

  /**
   * Get Cook DEX pool liquidity
   * 
   * This reads the actual AMM vault balances to determine liquidity.
   * For bonding curve launches without initial liquidity:
   * - Liquidity starts at 0 when pool is created
   * - Grows with each purchase as SOL accumulates in quote vault
   * - Each trade adds SOL to the pool, creating liquidity organically
   */
  private async getCookDEXLiquidity(tokenMint: PublicKey): Promise<PoolLiquidity> {
    try {
      // Derive AMM PDA
      const [ammPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenMint.toBuffer()],
        PROGRAM_ID
      );

      // Get AMM account data
      const ammAccountInfo = await this.connection.getAccountInfo(ammPDA);
      if (!ammAccountInfo) {
        // AMM account doesn't exist - pool hasn't been initialized yet
        // This is normal for new launches before first trade
        throw new Error('AMM account not initialized yet');
      }

      // Parse AMM account to get vault addresses and read actual reserves
      // This gives us real-time liquidity from actual token account balances
      const { marketDataService } = await import('./marketDataService');
      const ammData = await (marketDataService as any).getAMMAccountData(tokenMint.toBase58());
      
      if (!ammData) {
        // AMM data couldn't be parsed - pool might be partially initialized
        // Return zero liquidity
        return {
          tokensInPool: 0,
          solInPool: 0,
          totalLiquidity: 0,
          poolAddress: ammPDA.toBase58(),
          dexProvider: 'cook',
          isLocked: false
        };
      }

      // Get actual reserves from AMM vaults
      // These are the real balances in the pool
      const tokensInPool = ammData.tokenReserves || 0;
      const solInPool = ammData.solReserves || 0;
      const currentPrice = ammData.price || 0;
      
      // Calculate total liquidity
      // For a 50/50 pool: Total Liquidity = SOL Reserves × 2
      // This works because: SOL Reserves = Token Reserves × Price (for 50/50 pool)
      // So: Total = SOL + (Tokens × Price) = SOL + SOL = 2 × SOL
      const totalLiquidity = solInPool > 0 
        ? (solInPool * 2) // Simplified: 2 × SOL for 50/50 pool
        : (tokensInPool * currentPrice > 0 
          ? tokensInPool * currentPrice * 2 // Fallback if SOL is 0 but tokens exist
          : 0);

      console.log('📊 Cook DEX Liquidity:', {
        tokenMint: tokenMint.toBase58(),
        solInPool,
        tokensInPool,
        currentPrice,
        totalLiquidity,
        poolAddress: ammPDA.toBase58()
      });

      // Check if liquidity is locked
      const { liquidityLockService } = await import('./liquidityLockService');
      let lockInfo;
      try {
        lockInfo = await liquidityLockService.getLockInfo(ammPDA);
      } catch (error) {
        // Lock info might not be available - that's okay
        lockInfo = null;
      }
      
      return {
        tokensInPool,
        solInPool,
        totalLiquidity,
        poolAddress: ammPDA.toBase58(),
        dexProvider: 'cook',
        lockExpiry: lockInfo?.unlockDate ? lockInfo.unlockDate.getTime() : undefined,
        isLocked: lockInfo?.isLocked || false
      };
    } catch (error) {
      // If AMM doesn't exist or can't be read, return zero liquidity
      // This is expected for new launches before first trade
      console.log('Cook DEX liquidity check:', error.message);
      throw error;
    }
  }

  /**
   * Get Raydium pool liquidity
   */
  private async getRaydiumLiquidity(
    tokenMint: PublicKey,
    quoteMint: PublicKey
  ): Promise<PoolLiquidity> {
    try {
      const { raydiumService } = await import('./raydiumService');
      
      // Find pool
      const poolAddress = await raydiumService.findPool(tokenMint, quoteMint);
      if (!poolAddress) {
        throw new Error('Raydium pool not found');
      }

      // Get pool info
      const poolInfo = await raydiumService.getPoolInfo(poolAddress);
      if (!poolInfo) {
        throw new Error('Pool info not found');
      }

      // Get token account balances
      const baseAccountInfo = await getAccount(this.connection, poolInfo.baseVault);
      const quoteAccountInfo = await getAccount(this.connection, poolInfo.quoteVault);

      const tokensInPool = Number(baseAccountInfo.amount) / Math.pow(10, baseAccountInfo.decimals);
      const solInPool = Number(quoteAccountInfo.amount) / LAMPORTS_PER_SOL;
      const currentPrice = solInPool / tokensInPool;
      const totalLiquidity = solInPool + (tokensInPool * currentPrice);

      // Check if liquidity is locked (would need to check LP token lock)
      const { liquidityLockService } = await import('./liquidityLockService');
      const lockInfo = await liquidityLockService.getLockInfo(poolInfo.lpMint);
      
      return {
        tokensInPool,
        solInPool,
        totalLiquidity,
        poolAddress: poolAddress.toBase58(),
        dexProvider: 'raydium',
        lockExpiry: lockInfo?.unlockDate ? lockInfo.unlockDate.getTime() : undefined,
        isLocked: lockInfo?.isLocked || false
      };
    } catch (error) {
      console.error('Error getting Raydium liquidity:', error);
      throw error;
    }
  }

  /**
   * Get current token price
   */
  private async getCurrentPrice(tokenMint: string): Promise<number> {
    try {
      // For instant launches, try bonding curve price first
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
          const bondingCurvePrice = bondingCurveService.calculatePrice(tokensSold, bondingCurveConfig);
          if (bondingCurvePrice > 0) {
            return bondingCurvePrice;
          }
        }
      } catch (error) {
        console.warn('Error calculating bonding curve price:', error);
      }
      
      // Fallback to market data service
      const { marketDataService } = await import('./marketDataService');
      const marketData = await marketDataService.getMarketData(tokenMint);
      return marketData.price || 0;
    } catch (error) {
      console.warn('Error getting current price:', error);
      return 0;
    }
  }

  /**
   * Check if liquidity is locked
   */
  async isLiquidityLocked(tokenMint: string): Promise<boolean> {
    try {
      const liquidityData = await this.getLiquidityData(tokenMint);
      return liquidityData.poolLiquidity.isLocked || liquidityData.initialLiquidity.isLocked;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get lock expiry date
   */
  async getLockExpiry(tokenMint: string): Promise<Date | null> {
    try {
      const liquidityData = await this.getLiquidityData(tokenMint);
      const expiry = liquidityData.poolLiquidity.lockExpiry || liquidityData.initialLiquidity.lockExpiry;
      return expiry ? new Date(expiry) : null;
    } catch (error) {
      return null;
    }
  }
}

export const liquidityTrackingService = new LiquidityTrackingService();

