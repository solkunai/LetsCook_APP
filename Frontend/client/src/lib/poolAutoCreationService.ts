/**
 * Pool Auto-Creation Service
 * 
 * Automatically creates liquidity pools when bonding curve threshold is met
 * Supports both Cook DEX and Raydium
 * Includes LP token locking if enabled
 */

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getConnection } from './connection';
import { raydiumService } from './raydiumService';
import { liquidityLockService, LiquidityLockConfig } from './liquidityLockService';
import { realLaunchService } from './realLaunchService';

export interface PoolCreationConfig {
  tokenMint: PublicKey;
  solAmount: number;
  tokenAmount: number;
  dexProvider: 'cook' | 'raydium';
  lockLiquidity?: {
    enabled: boolean;
    lockDuration: number; // Duration in seconds
    lockAmount?: number; // Amount of LP tokens to lock (optional, locks all if not specified)
  };
  creator: PublicKey;
}

export interface PoolCreationResult {
  success: boolean;
  poolAddress?: PublicKey;
  lpTokenMint?: PublicKey;
  lockAddress?: PublicKey;
  transactionSignature?: string;
  error?: string;
}

export class PoolAutoCreationService {
  private connection: Connection;

  constructor(connection?: Connection) {
    this.connection = connection || getConnection('confirmed');
  }

  /**
   * Automatically create liquidity pool when threshold is met
   */
  async createPoolAutomatically(
    config: PoolCreationConfig,
    signTransaction: (tx: Transaction) => Promise<Transaction>
  ): Promise<PoolCreationResult> {
    try {
      console.log('🚀 Auto-creating liquidity pool...');
      console.log('  Token:', config.tokenMint.toBase58());
      console.log('  SOL Amount:', config.solAmount);
      console.log('  Token Amount:', config.tokenAmount);
      console.log('  DEX Provider:', config.dexProvider);
      console.log('  Lock Liquidity:', config.lockLiquidity?.enabled || false);

      if (config.dexProvider === 'raydium') {
        return await this.createRaydiumPool(config, signTransaction);
      } else {
        return await this.createCookDEXPool(config, signTransaction);
      }
    } catch (error) {
      console.error('❌ Error creating pool automatically:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create Raydium pool (50/50 token/SOL) and lock LP tokens if enabled
   */
  private async createRaydiumPool(
    config: PoolCreationConfig,
    signTransaction: (tx: Transaction) => Promise<Transaction>
  ): Promise<PoolCreationResult> {
    try {
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      
      // Find or create Raydium pool
      const poolAddress = await raydiumService.findOrCreatePool(
        config.tokenMint,
        WSOL_MINT,
        config.creator
      );

      if (!poolAddress) {
        return {
          success: false,
          error: 'Failed to create Raydium pool'
        };
      }

      console.log('✅ Raydium pool created:', poolAddress.toBase58());

      // Add liquidity to the pool
      try {
        const signature = await raydiumService.addLiquidity(
          poolAddress,
          config.creator,
          BigInt(Math.floor(config.solAmount * 1e9)), // Convert to lamports
          BigInt(Math.floor(config.tokenAmount * 1e9)), // Convert to token units
          signTransaction
        );

        // Get LP token mint from pool
        const poolInfo = await raydiumService.getPoolInfo(poolAddress);
        if (!poolInfo) {
          return {
            success: false,
            error: 'Failed to fetch pool info'
          };
        }

      // Lock LP tokens if enabled
      let lockAddress: PublicKey | undefined;
      if (config.lockLiquidity?.enabled) {
        console.log('🔒 Locking liquidity...');
        const lockAmount = config.lockLiquidity.lockAmount || 0; // Lock all if amount not specified (0 = all)
        const lockResult = await liquidityLockService.createLiquidityLock(
          config.creator,
          poolInfo.lpMint,
          lockAmount,
          config.lockLiquidity.lockDuration,
          signTransaction
        );

        if (lockResult.success && lockResult.lockAddress) {
          lockAddress = lockResult.lockAddress;
          console.log('✅ LP tokens locked:', lockAddress.toBase58());
        } else {
          console.warn('⚠️ Failed to lock LP tokens:', lockResult.error);
        }
      }

      // Emit on-chain event (would be done in the program)
      console.log('📡 Emitting pool creation event...');
      // In production, this would emit an on-chain event

        return {
          success: true,
          poolAddress,
          lpTokenMint: poolInfo.lpMint,
          lockAddress,
          transactionSignature: signature
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add liquidity'
        };
      }
    } catch (error) {
      console.error('❌ Error creating Raydium pool:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create Cook DEX pool
   */
  private async createCookDEXPool(
    config: PoolCreationConfig,
    signTransaction: (tx: Transaction) => Promise<Transaction>
  ): Promise<PoolCreationResult> {
    try {
      // Cook DEX pool creation
      // This would use the realLaunchService to add liquidity
      console.log('✅ Cook DEX pool created (handled by AMM)');

      // Note: Cook DEX pools are created automatically when first trade happens
      // We just need to ensure liquidity is added
      // Convert SOL to lamports (1 SOL = 1,000,000,000 lamports)
      const solAmountLamports = Math.floor(config.solAmount * 1_000_000_000);
      const tokenAmountRaw = Math.floor(config.tokenAmount);
      
      console.log(`💰 Adding liquidity: ${config.solAmount} SOL (${solAmountLamports} lamports), ${config.tokenAmount} tokens`);
      
      // Ensure creator is a PublicKey instance
      const creatorPubkey = config.creator instanceof PublicKey 
        ? config.creator 
        : new PublicKey(config.creator);
      
      const addLiquidityResult = await realLaunchService.buildAddLiquidityTransaction(
        config.tokenMint,
        new PublicKey('So11111111111111111111111111111111111111112'), // SOL
        solAmountLamports,    // amount_0: SOL in lamports (correct order and unit!)
        tokenAmountRaw,       // amount_1: token amount in raw units
        creatorPubkey
      );

      // Refresh blockhash right before sending to avoid expiration
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      addLiquidityResult.recentBlockhash = blockhash;
      // Ensure feePayer is a proper PublicKey instance
      addLiquidityResult.feePayer = creatorPubkey instanceof PublicKey 
        ? creatorPubkey 
        : new PublicKey(creatorPubkey);
      
      // Ensure all instruction keys are proper PublicKey instances
      // (This shouldn't be necessary, but helps prevent wallet adapter errors)
      for (const instruction of addLiquidityResult.instructions) {
        for (const key of instruction.keys) {
          // Skip if already a PublicKey instance
          if (key.pubkey instanceof PublicKey) {
            continue;
          }
          
          // Only try to convert if it's a string or can be converted to string
          if (key.pubkey && typeof key.pubkey === 'string') {
            try {
              key.pubkey = new PublicKey(key.pubkey);
            } catch (error) {
              console.error('❌ Invalid public key in instruction:', key.pubkey, error);
              // Skip invalid keys - they might be placeholders or system accounts
            }
          } else if (key.pubkey && typeof key.pubkey === 'object' && 'toBase58' in key.pubkey) {
            // Already a PublicKey-like object, leave it
            continue;
          } else {
            console.warn('⚠️ Skipping invalid pubkey:', key.pubkey);
          }
        }
      }
      
      const signedTx = await signTransaction(addLiquidityResult);
      const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3
      });
      await this.connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ Liquidity added to Cook DEX pool:', signature);

      // Emit on-chain event
      console.log('📡 Emitting pool creation event...');

      return {
        success: true,
        transactionSignature: signature
      };
    } catch (error) {
      console.error('❌ Error creating Cook DEX pool:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if threshold is met and trigger pool creation
   */
  async checkAndCreatePool(
    launchId: string,
    thresholdAmount: number,
    currentAmount: number,
    dexProvider: 'cook' | 'raydium',
    lockConfig?: LiquidityLockConfig,
    signTransaction?: (tx: Transaction) => Promise<Transaction>
  ): Promise<PoolCreationResult | null> {
    try {
      // Check if threshold is met
      if (currentAmount < thresholdAmount) {
        return null; // Threshold not met yet
      }

      console.log('✅ Threshold met! Creating liquidity pool...');

      // Get launch data
      const { launchDataService } = await import('./launchDataService');
      const launchData = await launchDataService.getLaunchById(launchId);
      if (!launchData) {
        return {
          success: false,
          error: 'Launch not found'
        };
      }

      if (!signTransaction) {
        return {
          success: false,
          error: 'Transaction signing function required'
        };
      }

      // Calculate 50/50 split for pool
      const solAmount = currentAmount / 2;
      const tokenAmount = launchData.totalSupply / 2; // Adjust based on actual tokenomics

      // Create pool
      const result = await this.createPoolAutomatically(
        {
          tokenMint: new PublicKey(launchData.baseTokenMint || launchData.id),
          solAmount,
          tokenAmount,
          dexProvider,
          lockLiquidity: lockConfig,
          creator: new PublicKey(launchData.creator)
        },
        signTransaction
      );

      if (result.success) {
        // Update launch metadata with DEX info
        await this.updateLaunchDEXMetadata(launchId, dexProvider, result.poolAddress);
        
        // Close bonding curve stage
        await this.closeBondingCurveStage(launchId);
      }

      return result;
    } catch (error) {
      console.error('❌ Error checking and creating pool:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update launch metadata with DEX information
   */
  private async updateLaunchDEXMetadata(
    launchId: string,
    dexProvider: 'cook' | 'raydium',
    poolAddress?: PublicKey
  ): Promise<void> {
    try {
      // In production, this would update on-chain metadata
      console.log(`📝 Updating launch metadata: Listed on ${dexProvider.toUpperCase()}`);
      if (poolAddress) {
        console.log('  Pool Address:', poolAddress.toBase58());
      }
      
      // This would call the backend to update metadata
      // For now, just log it
    } catch (error) {
      console.error('❌ Error updating DEX metadata:', error);
    }
  }

  /**
   * Close bonding curve stage
   */
  private async closeBondingCurveStage(launchId: string): Promise<void> {
    try {
      console.log('🔒 Closing bonding curve stage for launch:', launchId);
      // In production, this would update the launch state on-chain
      // For now, just log it
    } catch (error) {
      console.error('❌ Error closing bonding curve stage:', error);
    }
  }
}

export const poolAutoCreationService = new PoolAutoCreationService();

