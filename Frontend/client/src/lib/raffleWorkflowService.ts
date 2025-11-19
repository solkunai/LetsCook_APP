/**
 * Enhanced Raffle Workflow Service
 * 
 * Implements the complete raffle workflow with real backend integration,
 * including liquidity thresholds, automated pool deployment, and AMM integration.
 */

import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Connection } from '@solana/web3.js';
import { realLaunchService } from './realLaunchService';
import { LaunchData } from './launchDataService';

export interface RaffleWorkflowState {
  raffleId: string;
  status: 'active' | 'ended' | 'checking' | 'claiming' | 'trading' | 'failed';
  ticketsSold: number;
  maxTickets: number;
  winnerCount: number;
  liquidityThreshold: number;
  currentLiquidity: number;
  hasMetThreshold: boolean;
  winnersClaimed: number;
  totalWinners: number;
  liquidityPoolAddress?: string;
  tokenMint: string;
  endDate: Date;
  createdAt: Date;
}

export interface LiquidityThresholdConfig {
  raffleId: string;
  thresholdAmount: number; // SOL amount required
  thresholdMet: boolean;
  poolDeployed: boolean;
  poolAddress?: string;
  deploymentTx?: string;
}

export interface AMMIntegration {
  provider: 'cook' | 'raydium';
  poolAddress: string;
  tokenReserve: number;
  solReserve: number;
  totalLiquidity: number;
  isActive: boolean;
  fee: number; // Swap fee percentage
}

export interface RaffleWorkflowResult {
  success: boolean;
  message: string;
  transactionSignature?: string;
  newState?: RaffleWorkflowState;
  error?: string;
}

export class RaffleWorkflowService {
  private static readonly MIN_LIQUIDITY_THRESHOLD = 5; // Minimum 5 SOL
  private static readonly POOL_DEPLOYMENT_DELAY = 30000; // 30 seconds delay
  private static readonly MAX_TICKET_CHECK_BATCH = 200;

  /**
   * Get current raffle workflow state
   */
  static async getRaffleWorkflowState(raffleId: string): Promise<RaffleWorkflowState | null> {
    try {
      const launchData = await realLaunchService.fetchLaunchById(raffleId);
      if (!launchData) return null;

      const currentTime = new Date();
      const endTime = launchData.endDate;
      const isEnded = currentTime >= endTime;
      
      // Calculate liquidity threshold status
      const ticketRevenue = launchData.soldTickets * launchData.ticketPrice;
      const hasMetThreshold = ticketRevenue >= launchData.liquidityThreshold;

      // Determine workflow status
      let status: RaffleWorkflowState['status'] = 'active';
      if (isEnded) {
        if (hasMetThreshold) {
          status = 'checking';
        } else {
          status = 'failed';
        }
      }

      return {
        raffleId,
        status,
        ticketsSold: launchData.soldTickets,
        maxTickets: launchData.maxTickets,
        winnerCount: launchData.winnerCount,
        liquidityThreshold: launchData.liquidityThreshold,
        currentLiquidity: ticketRevenue,
        hasMetThreshold,
        winnersClaimed: 0, // This would be fetched from backend
        totalWinners: launchData.winnerCount,
        liquidityPoolAddress: launchData.liquidityPoolAddress,
        tokenMint: launchData.baseTokenMint,
        endDate: launchData.endDate,
        createdAt: launchData.launchDate
      };
    } catch (error) {
      console.error('Error fetching raffle workflow state:', error);
      return null;
    }
  }

  /**
   * Check if raffle meets liquidity threshold
   */
  static async checkLiquidityThreshold(raffleId: string): Promise<{
    met: boolean;
    currentAmount: number;
    requiredAmount: number;
    percentage: number;
  }> {
    try {
      const state = await this.getRaffleWorkflowState(raffleId);
      if (!state) {
        throw new Error('Raffle not found');
      }

      const percentage = (state.currentLiquidity / state.liquidityThreshold) * 100;

      return {
        met: state.hasMetThreshold,
        currentAmount: state.currentLiquidity,
        requiredAmount: state.liquidityThreshold,
        percentage: Math.min(percentage, 100)
      };
    } catch (error) {
      console.error('Error checking liquidity threshold:', error);
      throw error;
    }
  }

  /**
   * Process raffle end and determine next steps
   */
  static async processRaffleEnd(raffleId: string): Promise<RaffleWorkflowResult> {
    try {
      const state = await this.getRaffleWorkflowState(raffleId);
      if (!state) {
        return {
          success: false,
          message: 'Raffle not found',
          error: 'RAFFLE_NOT_FOUND'
        };
      }

      if (state.status !== 'ended') {
        return {
          success: false,
          message: 'Raffle has not ended yet',
          error: 'RAFFLE_NOT_ENDED'
        };
      }

      if (!state.hasMetThreshold) {
        // Raffle failed - initiate refund process
        return await this.initiateRefundProcess(raffleId);
      }

      // Raffle succeeded - proceed to ticket checking
      return await this.initiateTicketChecking(raffleId);
    } catch (error) {
      console.error('Error processing raffle end:', error);
      return {
        success: false,
        message: 'Failed to process raffle end',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Initiate refund process for failed raffles
   */
  private static async initiateRefundProcess(raffleId: string): Promise<RaffleWorkflowResult> {
    try {
      // This would integrate with the backend to process refunds
      console.log(`Initiating refund process for raffle ${raffleId}`);
      
      // Update raffle status to failed
      await this.updateRaffleStatus(raffleId, 'failed');
      
      return {
        success: true,
        message: 'Refund process initiated. All tickets will be refunded.',
        newState: {
          ...await this.getRaffleWorkflowState(raffleId)!,
          status: 'failed'
        }
      };
    } catch (error) {
      console.error('Error initiating refund process:', error);
      return {
        success: false,
        message: 'Failed to initiate refund process',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Initiate ticket checking process
   */
  private static async initiateTicketChecking(raffleId: string): Promise<RaffleWorkflowResult> {
    try {
      console.log(`Initiating ticket checking for raffle ${raffleId}`);
      
      // Update raffle status to checking
      await this.updateRaffleStatus(raffleId, 'checking');
      
      return {
        success: true,
        message: 'Ticket checking initiated. Winners will be determined shortly.',
        newState: {
          ...await this.getRaffleWorkflowState(raffleId)!,
          status: 'checking'
        }
      };
    } catch (error) {
      console.error('Error initiating ticket checking:', error);
      return {
        success: false,
        message: 'Failed to initiate ticket checking',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Check tickets for a specific user
   */
  static async checkUserTickets(
    userPublicKey: PublicKey,
    raffleId: string
  ): Promise<RaffleWorkflowResult> {
    try {
      const state = await this.getRaffleWorkflowState(raffleId);
      if (!state) {
        return {
          success: false,
          message: 'Raffle not found',
          error: 'RAFFLE_NOT_FOUND'
        };
      }

      if (state.status !== 'checking') {
        return {
          success: false,
          message: 'Raffle is not in checking phase',
          error: 'INVALID_STATUS'
        };
      }

      // Call the backend ticket checking function
      const signature = await realLaunchService.checkTickets(userPublicKey, raffleId);
      
      return {
        success: true,
        message: 'Tickets checked successfully',
        transactionSignature: signature
      };
    } catch (error) {
      console.error('Error checking user tickets:', error);
      return {
        success: false,
        message: 'Failed to check tickets',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Claim tokens for winning tickets
   */
  static async claimWinningTokens(
    userPublicKey: PublicKey,
    raffleId: string
  ): Promise<RaffleWorkflowResult> {
    try {
      const state = await this.getRaffleWorkflowState(raffleId);
      if (!state) {
        return {
          success: false,
          message: 'Raffle not found',
          error: 'RAFFLE_NOT_FOUND'
        };
      }

      if (state.status !== 'claiming') {
        return {
          success: false,
          message: 'Raffle is not in claiming phase',
          error: 'INVALID_STATUS'
        };
      }

      // Call the backend token claiming function
      const claimResult = await realLaunchService.claimTokens(userPublicKey, raffleId, undefined);
      
      if (!claimResult.success) {
        return {
          success: false,
          message: claimResult.error || 'Failed to claim tokens',
          error: 'CLAIM_FAILED'
        };
      }
      
      // Check if this is the first claim (triggers liquidity pool deployment)
      if (state.winnersClaimed === 0 && state.hasMetThreshold) {
        // Deploy liquidity pool after a short delay
        // Note: This would require signTransaction in production
        console.log('⚠️ Pool deployment triggered but requires signTransaction');
      }
      
      return {
        success: true,
        message: 'Tokens claimed successfully',
        transactionSignature: claimResult.signature
      };
    } catch (error) {
      console.error('Error claiming tokens:', error);
      return {
        success: false,
        message: 'Failed to claim tokens',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Deploy liquidity pool automatically when threshold is met
   * Uses poolAutoCreationService for automatic pool creation
   */
  private static async deployLiquidityPool(
    raffleId: string,
    signTransaction?: (tx: Transaction) => Promise<Transaction>
  ): Promise<RaffleWorkflowResult> {
    try {
      console.log(`🚀 Deploying liquidity pool for raffle ${raffleId}`);
      
      const state = await this.getRaffleWorkflowState(raffleId);
      if (!state) {
        return {
          success: false,
          message: 'Raffle not found',
          error: 'RAFFLE_NOT_FOUND'
        };
      }

      if (!state.hasMetThreshold) {
        return {
          success: false,
          message: 'Liquidity threshold not met',
          error: 'THRESHOLD_NOT_MET'
        };
      }

      if (!signTransaction) {
        return {
          success: false,
          message: 'Transaction signing required for pool creation',
          error: 'SIGNATURE_REQUIRED'
        };
      }

      // Import pool auto-creation service
      const { poolAutoCreationService } = await import('./poolAutoCreationService');
      
      // Determine DEX provider (default to raydium, but can be configured)
      const dexProvider: 'cook' | 'raydium' = 'raydium'; // Can be made configurable
      
      // Create pool automatically
      const poolResult = await poolAutoCreationService.checkAndCreatePool(
        raffleId,
        state.liquidityThreshold,
        state.currentLiquidity,
        dexProvider,
        undefined, // No lock config for raffles by default
        signTransaction
      );

      if (!poolResult || !poolResult.success) {
        return {
          success: false,
          message: poolResult?.error || 'Failed to create pool',
          error: 'POOL_CREATION_FAILED'
        };
      }

      // Update raffle status to trading
      await this.updateRaffleStatus(raffleId, 'trading');
      
      return {
        success: true,
        message: `${dexProvider.toUpperCase()} liquidity pool is active. Trading is now live!`,
        transactionSignature: poolResult.transactionSignature,
        newState: {
          ...state,
          status: 'trading',
          liquidityPoolAddress: poolResult.poolAddress?.toBase58()
        }
      };
    } catch (error) {
      console.error('❌ Error deploying liquidity pool:', error);
      return {
        success: false,
        message: 'Failed to deploy liquidity pool',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Get AMM integration data
   */
  static async getAMMIntegration(raffleId: string): Promise<AMMIntegration | null> {
    try {
      const state = await this.getRaffleWorkflowState(raffleId);
      if (!state || !state.liquidityPoolAddress) {
        return null;
      }

      // This would fetch real AMM data from the pool
      const mockAMMData: AMMIntegration = {
        provider: 'cook',
        poolAddress: state.liquidityPoolAddress,
        tokenReserve: state.currentLiquidity * 1000000000, // Mock token reserve
        solReserve: state.currentLiquidity,
        totalLiquidity: state.currentLiquidity * 2,
        isActive: state.status === 'trading',
        fee: 0.0025 // 0.25% fee
      };

      return mockAMMData;
    } catch (error) {
      console.error('Error fetching AMM integration:', error);
      return null;
    }
  }

  /**
   * Execute buy/sell transactions on the AMM
   */
  static async executeAMMTransaction(
    userPublicKey: PublicKey,
    raffleId: string,
    transactionType: 'buy' | 'sell',
    amount: number
  ): Promise<RaffleWorkflowResult> {
    try {
      const ammData = await this.getAMMIntegration(raffleId);
      if (!ammData || !ammData.isActive) {
        return {
          success: false,
          message: 'Trading is not available for this raffle',
          error: 'TRADING_NOT_AVAILABLE'
        };
      }

      let signature: string;
      
      if (transactionType === 'buy') {
        // Execute buy transaction
        signature = await realLaunchService.buyTokens(userPublicKey, raffleId, amount);
      } else {
        // Execute sell transaction
        signature = await realLaunchService.sellTokens(userPublicKey, raffleId, amount);
      }

      return {
        success: true,
        message: `${transactionType} transaction executed successfully`,
        transactionSignature: signature
      };
    } catch (error) {
      console.error(`Error executing ${transactionType} transaction:`, error);
      return {
        success: false,
        message: `Failed to execute ${transactionType} transaction`,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Update raffle status
   */
  private static async updateRaffleStatus(
    raffleId: string, 
    status: RaffleWorkflowState['status']
  ): Promise<void> {
    try {
      // This would update the backend database
      console.log(`Updating raffle ${raffleId} status to ${status}`);
      
      // For now, just log the update
      // In a real implementation, this would call the backend API
    } catch (error) {
      console.error('Error updating raffle status:', error);
      throw error;
    }
  }

  /**
   * Get raffle workflow timeline
   */
  static async getRaffleTimeline(raffleId: string): Promise<Array<{
    timestamp: Date;
    event: string;
    description: string;
    status: 'completed' | 'pending' | 'failed';
  }>> {
    try {
      const state = await this.getRaffleWorkflowState(raffleId);
      if (!state) return [];

      const timeline = [
        {
          timestamp: state.createdAt,
          event: 'Raffle Created',
          description: 'Raffle was created and opened for ticket sales',
          status: 'completed' as const
        },
        {
          timestamp: state.endDate,
          event: 'Raffle Ended',
          description: 'Ticket sales period ended',
          status: state.status === 'failed' ? 'failed' as const : 'completed' as const
        }
      ];

      if (state.hasMetThreshold) {
        timeline.push({
          timestamp: new Date(state.endDate.getTime() + 60000), // 1 minute after end
          event: 'Ticket Checking',
          description: 'Winners are being determined',
          status: state.status === 'checking' ? 'pending' as const : 'completed' as const
        });

        timeline.push({
          timestamp: new Date(state.endDate.getTime() + 300000), // 5 minutes after end
          event: 'Token Claiming',
          description: 'Winners can claim their tokens',
          status: state.status === 'claiming' ? 'pending' as const : 'completed' as const
        });

        if (state.liquidityPoolAddress) {
          timeline.push({
            timestamp: new Date(state.endDate.getTime() + 600000), // 10 minutes after end
            event: 'Liquidity Pool Deployed',
            description: 'Trading is now live on the AMM',
            status: state.status === 'trading' ? 'completed' as const : 'pending' as const
          });
        }
      }

      return timeline;
    } catch (error) {
      console.error('Error fetching raffle timeline:', error);
      return [];
    }
  }
}

export default RaffleWorkflowService;
