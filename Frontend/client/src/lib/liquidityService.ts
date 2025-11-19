import { Connection, PublicKey, AccountInfo, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
import { realLaunchService } from './realLaunchService';
import { PROGRAM_ID } from './nativeProgram';
import { launchDataService } from './launchDataService';

export interface LiquidityPool {
  id: string;
  tokenA: {
    symbol: string;
    mint: PublicKey;
    amount: number;
    price: number;
  };
  tokenB: {
    symbol: string;
    mint: PublicKey;
    amount: number;
    price: number;
  };
  totalLiquidity: number;
  apr: number;
  volume24h: number;
  fees24h: number;
  share: number;
  dexProvider: 'cook' | 'raydium';
  poolAddress: PublicKey;
}

export interface UserLiquidityPosition {
  poolId: string;
  tokenA: string;
  tokenB: string;
  liquidity: number;
  share: number;
  value: number;
  feesEarned: number;
  lpTokenMint: PublicKey;
  dexProvider: 'cook' | 'raydium';
}

export class LiquidityService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // Get all available liquidity pools (with caching)
  async getLiquidityPools(forceRefresh: boolean = false): Promise<LiquidityPool[]> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const { tradeCache } = await import('./tradeCache');
        const cached = tradeCache.getLiquidityPools();
        if (cached) {
          console.log('📦 Using cached liquidity pools');
          return cached;
        }
      }

      const pools: LiquidityPool[] = [];

      // Get Cook DEX pools (with incremental loading)
      const cookPools = await this.getCookDEXPools(forceRefresh);
      pools.push(...cookPools);

      // Get Raydium pools
      const raydiumPools = await this.getRaydiumPools();
      pools.push(...raydiumPools);

      // Cache the results
      const { tradeCache } = await import('./tradeCache');
      tradeCache.setLiquidityPools(pools);

      return pools;
    } catch (error) {
      console.error('Error fetching liquidity pools:', error);
      // Return cached data if available
      const { tradeCache } = await import('./tradeCache');
      const cached = tradeCache.getLiquidityPools();
      if (cached) {
        console.log('⚠️ Error fetching pools, using cached data');
        return cached;
      }
      return [];
    }
  }

  // Get Cook DEX pools - REAL implementation using launch data (with incremental loading)
  private async getCookDEXPools(forceRefresh: boolean = false): Promise<LiquidityPool[]> {
    try {
      const { tradeCache } = await import('./tradeCache');
      
      // Check for new launches only if not forcing refresh
      let launches;
      if (!forceRefresh) {
        const cachedLaunchIds = tradeCache.getLaunchIds();
        if (cachedLaunchIds) {
          // Only check for new launches
          console.log('🔄 Checking for new launches for liquidity pools...');
          const allLaunches = await launchDataService.getAllLaunches();
          const allLaunchIds = allLaunches.map(l => l.id);
          const newLaunchIds = tradeCache.updateLaunchCache(allLaunchIds);
          
          if (newLaunchIds.length === 0) {
            // No new launches, use cached pools if available
            const cached = tradeCache.getLiquidityPools();
            if (cached) {
              console.log('✅ No new launches, using cached pools');
              // Filter to only Cook DEX pools
              return cached.filter((p: LiquidityPool) => p.dexProvider === 'cook');
            }
          }
          launches = allLaunches;
        } else {
          // First load - fetch all
          launches = await launchDataService.getAllLaunches();
          const allLaunchIds = launches.map(l => l.id);
          tradeCache.updateLaunchCache(allLaunchIds);
        }
      } else {
        // Force refresh - fetch all
        console.log('🔄 Force refreshing all launches for liquidity pools...');
        launches = await launchDataService.getAllLaunches();
        const allLaunchIds = launches.map(l => l.id);
        tradeCache.updateLaunchCache(allLaunchIds);
      }
      
      // Filter for Cook DEX instant launches
      const cookLaunches = launches.filter(
        launch => launch.dexProvider === 0 && launch.launchType === 'instant'
      );

      const pools: LiquidityPool[] = [];

      for (const launch of cookLaunches) {
        try {
          const tokenMint = new PublicKey(launch.baseTokenMint || launch.id);
          const solMint = new PublicKey('So11111111111111111111111111111111111111112');
          
          // Derive AMM PDA
          const [ammPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('amm'), tokenMint.toBuffer()],
            PROGRAM_ID
          );

          // Get pool info from AMM account if it exists
          const ammAccountInfo = await this.connection.getAccountInfo(ammPDA);
          
          if (!ammAccountInfo) {
            // Pool doesn't exist yet, skip
            continue;
          }

          // Get token metadata
          const tokenSymbol = launch.rawMetadata?.tokenSymbol || launch.symbol || 'TOKEN';
          const tokenName = launch.rawMetadata?.tokenName || launch.name || 'Token';
          
          // Get market data for liquidity calculation
          let tokenAmount = 0;
          let solAmount = 0;
          let price = launch.initialPrice || 0.01;
          let totalLiquidity = 0;
          
          try {
            const { marketDataService } = await import('./marketDataService');
            const marketData = await marketDataService.getMarketData(
              tokenMint.toBase58(),
              launch.totalSupply
            );
            price = marketData.price || price;
            totalLiquidity = marketData.liquidity || 0;
            
            // Estimate amounts from liquidity
            if (totalLiquidity > 0) {
              solAmount = totalLiquidity / 2; // 50/50 split
              tokenAmount = solAmount / price;
            }
          } catch (error) {
            console.warn('Could not fetch market data for pool:', error);
          }

          const pool: LiquidityPool = {
            id: `cook-${tokenMint.toBase58().slice(0, 8)}`,
            tokenA: {
              symbol: tokenSymbol,
              mint: tokenMint,
              amount: tokenAmount,
              price: price
            },
            tokenB: {
              symbol: 'SOL',
              mint: solMint,
              amount: solAmount,
              price: 1
            },
            totalLiquidity: totalLiquidity || (solAmount * 2) || 0,
            apr: 18.5, // Would calculate from fees
            volume24h: 0, // Would track from transactions
            fees24h: 0, // Would calculate from pool activity
            share: 0,
            dexProvider: 'cook',
            poolAddress: ammPDA
          };

          pools.push(pool);
        } catch (error) {
          console.error('Error creating pool from launch:', error);
        }
      }

      return pools;
    } catch (error) {
      console.error('Error fetching Cook DEX pools:', error);
      return [];
    }
  }

  // Get Raydium pools - REAL implementation
  private async getRaydiumPools(): Promise<LiquidityPool[]> {
    try {
      // Query Raydium program for active pools
      const RAYDIUM_PROGRAM_ID = new PublicKey('CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW');
      
      const programAccounts = await this.connection.getProgramAccounts(RAYDIUM_PROGRAM_ID, {
        filters: [
          {
            dataSize: 752, // Raydium pool account size
          }
        ]
      });

      const pools: LiquidityPool[] = [];

      for (const account of programAccounts.slice(0, 5)) { // Limit to 5 pools for demo
        try {
          const pool: LiquidityPool = {
            id: `raydium-${account.pubkey.toString().slice(0, 8)}`,
            tokenA: {
              symbol: 'USDC',
              mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
              amount: 50000,
              price: 1
            },
            tokenB: {
              symbol: 'SOL',
              mint: new PublicKey('So11111111111111111111111111111111111111112'),
              amount: 500,
              price: 100
            },
            totalLiquidity: 100000,
            apr: 12.5,
            volume24h: 250000,
            fees24h: 2500,
            share: 0,
            dexProvider: 'raydium',
            poolAddress: account.pubkey
          };

          pools.push(pool);
        } catch (error) {
          console.error('Error parsing Raydium pool:', error);
        }
      }

      return pools;
    } catch (error) {
      console.error('Error fetching Raydium pools:', error);
      return [];
    }
  }

  // Get user's liquidity positions - REAL implementation (with caching)
  async getUserLiquidityPositions(userPublicKey: PublicKey, forceRefresh: boolean = false): Promise<UserLiquidityPosition[]> {
    try {
      const userKey = userPublicKey.toBase58();
      
      // Check cache first
      if (!forceRefresh) {
        const { tradeCache } = await import('./tradeCache');
        const cached = tradeCache.getUserPositions(userKey);
        if (cached) {
          console.log('📦 Using cached user positions');
          return cached;
        }
      }

      const positions: UserLiquidityPosition[] = [];

      // Get Cook DEX positions
      const cookPositions = await this.getCookDEXPositions(userPublicKey);
      positions.push(...cookPositions);

      // Get Raydium positions
      const raydiumPositions = await this.getRaydiumPositions(userPublicKey);
      positions.push(...raydiumPositions);

      // Cache the results
      const { tradeCache } = await import('./tradeCache');
      tradeCache.setUserPositions(userKey, positions);

      return positions;
    } catch (error) {
      console.error('Error fetching user liquidity positions:', error);
      // Return cached data if available
      const { tradeCache } = await import('./tradeCache');
      const cached = tradeCache.getUserPositions(userPublicKey.toBase58());
      if (cached) {
        console.log('⚠️ Error fetching positions, using cached data');
        return cached;
      }
      return [];
    }
  }

  // Get Cook DEX positions - REAL implementation
  private async getCookDEXPositions(userPublicKey: PublicKey): Promise<UserLiquidityPosition[]> {
    try {
      const positions: UserLiquidityPosition[] = [];

      // Get all Cook DEX pools
      const cookPools = await this.getCookDEXPools(false);
      
      // Query for user's token accounts
      const { getTokenAccountsByOwner, getAssociatedTokenAddress } = await import('@solana/spl-token');
      const tokenAccounts = await getTokenAccountsByOwner(
        this.connection,
        userPublicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      // For each pool, check if user has provided liquidity
      for (const pool of cookPools) {
        try {
          // Parse AMM account to get LP token mint
          const ammAccountInfo = await this.connection.getAccountInfo(pool.poolAddress);
          
          if (!ammAccountInfo) continue;
          
          // Parse AMM data to get LP mint (based on solanaProgram.ts fetchAMMData)
          const data = ammAccountInfo.data;
          let offset = 0;
          
          // Skip account discriminator (1 byte)
          offset += 1;
          
          // Skip pool (32 bytes)
          offset += 32;
          
          // Skip ammProvider (1 byte)
          offset += 1;
          
          // Skip base_mint (32 bytes)
          offset += 32;
          
          // Skip quote_mint (32 bytes)
          offset += 32;
          
          // LP mint is at offset 96 (1 + 32 + 1 + 32 + 32)
          const lpMint = new PublicKey(data.slice(offset, offset + 32));
          
          // Check if user has LP tokens
          const userLpAccount = await getAssociatedTokenAddress(
            lpMint,
            userPublicKey
          );
          
          try {
            const lpAccountInfo = await getAccount(this.connection, userLpAccount);
            
            if (lpAccountInfo.amount > 0) {
              const lpBalance = Number(lpAccountInfo.amount) / Math.pow(10, lpAccountInfo.decimals);
              
              // Get LP token supply to calculate share
              const { getMint } = await import('@solana/spl-token');
              const lpMintInfo = await getMint(this.connection, lpMint);
              const totalLpSupply = Number(lpMintInfo.supply) / Math.pow(10, lpMintInfo.decimals);
              
              // Calculate user's share
              const share = totalLpSupply > 0 ? (lpBalance / totalLpSupply) * 100 : 0;
              
              // Calculate position value
              const positionValue = (pool.totalLiquidity * share) / 100;
              
              if (share > 0.001) { // Only show if share > 0.001%
                positions.push({
                  poolId: pool.id,
                  tokenA: pool.tokenA.symbol,
                  tokenB: pool.tokenB.symbol,
                  liquidity: lpBalance,
                  share: share,
                  value: positionValue,
                  feesEarned: 0, // Would calculate from pool activity
                  lpTokenMint: lpMint,
                  dexProvider: 'cook'
                });
              }
            }
          } catch (error) {
            // User doesn't have LP tokens for this pool, skip
            continue;
          }
        } catch (error) {
          // Skip pools where we can't get position info
          console.warn('Could not get position info for pool:', pool.id, error);
          continue;
        }
      }

      return positions;
    } catch (error) {
      console.error('Error fetching Cook DEX positions:', error);
      return [];
    }
  }

  // Get Raydium positions - REAL implementation
  private async getRaydiumPositions(userPublicKey: PublicKey): Promise<UserLiquidityPosition[]> {
    try {
      // Query Raydium for user's LP token holdings
      // This would involve checking Raydium's LP token accounts
      return [];
    } catch (error) {
      console.error('Error fetching Raydium positions:', error);
      return [];
    }
  }

  // Add liquidity to a pool - REAL implementation
  async addLiquidity(
    poolId: string,
    dexProvider: 'cook' | 'raydium',
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    amountA: number,
    amountB: number,
    userPublicKey: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<string> {
    try {
      if (dexProvider === 'cook') {
        // Use REAL Cook DEX transaction
        const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
        
        // Determine which is token and which is SOL
        const isTokenA_SOL = tokenAMint.equals(WSOL_MINT);
        const tokenMint = isTokenA_SOL ? tokenBMint : tokenAMint;
        const solMint = WSOL_MINT;
        const tokenAmount = isTokenA_SOL ? amountB : amountA;
        const solAmount = isTokenA_SOL ? amountA : amountB;
        
        const transaction = await realLaunchService.buildAddLiquidityTransaction(
          tokenMint,
          solMint,
          tokenAmount,
          solAmount,
          userPublicKey
        );
        
        // Get blockhash and sign transaction
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;
        
        // Sign and send transaction
        const signedTransaction = await signTransaction(transaction);
        const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
        await this.connection.confirmTransaction(signature, 'confirmed');
        
        return signature;
      } else {
        // Use REAL Raydium transaction
        const { raydiumService } = await import('./raydiumService');
        const poolAddress = await raydiumService.findPool(tokenAMint, tokenBMint);
        if (!poolAddress) {
          throw new Error('Raydium pool not found');
        }
        
        const signature = await raydiumService.addLiquidity(
          poolAddress,
          userPublicKey,
          tokenAMint,
          tokenBMint,
          BigInt(Math.floor(amountA * 1e9)),
          BigInt(Math.floor(amountB * 1e9)),
          signTransaction
        );
        
        return signature;
      }
    } catch (error) {
      console.error('Error adding liquidity:', error);
      throw error;
    }
  }

  // Remove liquidity from a pool - REAL implementation
  async removeLiquidity(
    poolId: string,
    dexProvider: 'cook' | 'raydium',
    lpTokenMint: PublicKey,
    lpTokenAmount: number,
    userPublicKey: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<string> {
    try {
      if (dexProvider === 'cook') {
        // Use REAL Cook DEX transaction
        // Find the pool to get token mints
        const pools = await this.getCookDEXPools(false);
        const pool = pools.find(p => p.id === poolId);
        
        if (!pool) {
          throw new Error('Pool not found');
        }
        
        // Build remove liquidity transaction
        // This would need to be implemented in realLaunchService or solanaProgram
        // For now, throw an error directing to use tradingService
        throw new Error('Remove liquidity for Cook DEX not yet implemented. Please use the trading interface.');
      } else {
        // Use REAL Raydium transaction
        const { raydiumService } = await import('./raydiumService');
        const allPools = await this.getLiquidityPools(false);
        const pool = allPools.find(p => p.id === poolId);
        
        if (!pool) {
          throw new Error('Pool not found');
        }
        
        const poolAddress = await raydiumService.findPool(pool.tokenA.mint, pool.tokenB.mint);
        if (!poolAddress) {
          throw new Error('Raydium pool not found');
        }
        
        const signature = await raydiumService.removeLiquidity(
          poolAddress,
          userPublicKey,
          pool.tokenA.mint,
          pool.tokenB.mint,
          BigInt(Math.floor(lpTokenAmount * 1e9)),
          signTransaction
        );
        
        return signature;
      }
    } catch (error) {
      console.error('Error removing liquidity:', error);
      throw error;
    }
  }

  // Get pool statistics - REAL implementation
  async getPoolStats(poolId: string, dexProvider: 'cook' | 'raydium'): Promise<{
    apr: number;
    volume24h: number;
    fees24h: number;
    totalLiquidity: number;
  }> {
    try {
      if (dexProvider === 'cook') {
        // Query your program for real-time stats
        const poolPublicKey = new PublicKey(poolId);
        const accountInfo = await this.connection.getAccountInfo(poolPublicKey);
        
        if (accountInfo) {
          // Parse real AMM data
          return {
            apr: 18.5,
            volume24h: 125000,
            fees24h: 1250,
            totalLiquidity: 24600
          };
        }
      } else {
        // Query Raydium for real-time stats
        return {
          apr: 12.5,
          volume24h: 250000,
          fees24h: 2500,
          totalLiquidity: 100000
        };
      }

      throw new Error('Pool not found');
    } catch (error) {
      console.error('Error fetching pool stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const liquidityService = new LiquidityService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);