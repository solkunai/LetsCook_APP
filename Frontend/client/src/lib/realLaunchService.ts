import { PublicKey, Transaction, SystemProgram, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID } from './nativeProgram';
import { launchDataService } from './launchDataService';
import type { LaunchData } from './launchDataService';
import { tradingService } from './tradingService';
import type { SwapQuote, TradeResult } from './tradingService';
import { getConnectionWithTimeout } from './connection';

// Re-export interfaces for backward compatibility
export type { LaunchData } from './launchDataService';
export type { SwapQuote, TradeResult } from './tradingService';

export class RealLaunchService {
  private connection: ReturnType<typeof getConnectionWithTimeout>;

  constructor(connection: ReturnType<typeof getConnectionWithTimeout>) {
    this.connection = connection;
  }

  /**
   * Fetch all launches from the blockchain
   */
  async fetchAllLaunches(): Promise<LaunchData[]> {
    return launchDataService.getAllLaunches();
  }

  /**
   * Get swap quote for trading
   */
  async getSwapQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: number,
    dexProvider: 'cook' | 'raydium' = 'raydium'
  ): Promise<SwapQuote> {
    return tradingService.getSwapQuote(inputMint, outputMint, amount, dexProvider);
  }

  /**
   * Buy tokens using instant swap
   */
  async buyTokensAMM(
    tokenMint: string,
    userPublicKey: string,
    solAmount: number,
    signTransaction?: (transaction: Transaction) => Promise<Transaction>,
    dexProvider: 'cook' | 'raydium' = 'raydium'
  ): Promise<TradeResult> {
    return tradingService.buyTokensAMM(tokenMint, userPublicKey, solAmount, signTransaction, dexProvider);
  }

  /**
   * Sell tokens using instant swap
   */
  async sellTokensAMM(
    tokenMint: string,
    userPublicKey: string,
    tokenAmount: number,
    signTransaction?: (transaction: Transaction) => Promise<Transaction>,
    dexProvider: 'cook' | 'raydium' = 'raydium'
  ): Promise<TradeResult> {
    return tradingService.sellTokensAMM(tokenMint, userPublicKey, tokenAmount, signTransaction, dexProvider);
  }

  /**
   * Buy raffle tickets
   */
  async buyTickets(
    raffleId: string,
    userPublicKey: string,
    ticketCount: number,
    totalCost: number,
    signTransaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> {
    return tradingService.buyTickets(raffleId, userPublicKey, ticketCount, totalCost, signTransaction);
  }

  /**
   * Claim tokens from raffle
   */
  async claimTokens(
    raffleId: string,
    userPublicKey: string,
    signTransaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    tokenAmount?: number;
    error?: string;
  }> {
    return tradingService.claimTokens(raffleId, userPublicKey, signTransaction);
  }

  /**
   * Claim refund from raffle
   */
  async claimRefund(
    raffleId: string,
    userPublicKey: string,
    signTransaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    refundAmount?: number;
    error?: string;
  }> {
    return tradingService.claimRefund(raffleId, userPublicKey, signTransaction);
  }

  /**
   * Instant swap for instant launches
   */
  async instantSwap(
    raffleId: string,
    userPublicKey: string,
    solAmount: number,
    minimumTokenAmount: number,
    signTransaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    tokenAmount?: number;
    error?: string;
  }> {
    return tradingService.instantSwap(raffleId, userPublicKey, solAmount, minimumTokenAmount, signTransaction);
  }

  /**
   * Build add liquidity transaction for Cook DEX
   * Note: amounts should already be in lamports/raw units when passed to this function
   */
  async buildAddLiquidityTransaction(
    tokenMint: PublicKey,
    solMint: PublicKey,
    tokenAmount: number, // Already in raw units (not multiplied by decimals)
    solAmount: number, // Already in lamports (not multiplied by LAMPORTS_PER_SOL)
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    const { buildAddLiquidityTransaction } = await import('./solanaProgram');
    // Amounts are already in correct units, pass them directly
    return buildAddLiquidityTransaction(
      tokenMint,
      solMint,
      tokenAmount, // Already in raw units
      solAmount, // Already in lamports
      userPublicKey
    );
  }
}

// Export a default instance
export const realLaunchService = new RealLaunchService(
  getConnectionWithTimeout('confirmed', 60000)
);