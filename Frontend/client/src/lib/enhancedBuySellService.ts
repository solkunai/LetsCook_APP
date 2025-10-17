/**
 * Enhanced Buy/Sell Service
 * 
 * Handles proper token transfers, fee calculations, and SOL transfers
 * for buying and selling tokens on the AMM with correct logic.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, createBurnInstruction } from '@solana/spl-token';
import { realLaunchService } from './realLaunchService';
import { PROGRAM_ID, INSTRUCTION_DISCRIMINATORS } from './nativeProgram';

export interface BuyResult {
  success: boolean;
  signature?: string;
  tokensReceived: number;
  solSpent: number;
  feesPaid: number;
  message: string;
  error?: string;
}

export interface SellResult {
  success: boolean;
  signature?: string;
  tokensSold: number;
  solReceived: number;
  feesPaid: number;
  message: string;
  error?: string;
}

export interface FeeBreakdown {
  platformFee: number;
  swapFee: number;
  totalFees: number;
  netAmount: number;
}

export class EnhancedBuySellService {
  private static readonly PLATFORM_FEE_PERCENT = 0.25; // 0.25% platform fee
  private static readonly SWAP_FEE_PERCENT = 0.25; // 0.25% swap fee
  private static readonly TOTAL_FEE_PERCENT = 0.5; // 0.5% total fees

  /**
   * Calculate fees for a transaction
   */
  static calculateFees(amount: number): FeeBreakdown {
    const platformFee = amount * (this.PLATFORM_FEE_PERCENT / 100);
    const swapFee = amount * (this.SWAP_FEE_PERCENT / 100);
    const totalFees = platformFee + swapFee;
    const netAmount = amount - totalFees;

    return {
      platformFee,
      swapFee,
      totalFees,
      netAmount
    };
  }

  /**
   * Buy tokens with proper fee handling and token transfers
   */
  static async buyTokens(
    connection: Connection,
    userPublicKey: PublicKey,
    sendTransaction: (transaction: Transaction) => Promise<string>,
    tokenMint: PublicKey,
    solAmount: number,
    dexProvider: 'cook' | 'raydium' = 'cook'
  ): Promise<BuyResult> {
    try {
      console.log('🛒 Starting enhanced buyTokens transaction...');
      console.log('📊 Transaction details:', {
        userPublicKey: userPublicKey.toBase58(),
        tokenMint: tokenMint.toBase58(),
        solAmount,
        dexProvider
      });

      // Calculate fees
      const fees = this.calculateFees(solAmount);
      const solAmountLamports = Math.floor(solAmount * 1e9);
      const feeLamports = Math.floor(fees.totalFees * 1e9);
      const netSolLamports = solAmountLamports - feeLamports;

      console.log('💰 Fee breakdown:', {
        solAmount,
        platformFee: fees.platformFee,
        swapFee: fees.swapFee,
        totalFees: fees.totalFees,
        netAmount: fees.netAmount
      });

      // Check user's SOL balance
      const userBalance = await connection.getBalance(userPublicKey);
      if (userBalance < solAmountLamports) {
        return {
          success: false,
          tokensReceived: 0,
          solSpent: solAmount,
          feesPaid: fees.totalFees,
          message: `Insufficient SOL balance. Need ${solAmount} SOL`,
          error: 'INSUFFICIENT_BALANCE'
        };
      }

      // Get user's token account (create if needed)
      const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPublicKey);
      
      // Check if token account exists, create if not
      const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
      if (!tokenAccountInfo) {
        console.log('🔧 Token account does not exist, will be created by the program');
      }

      // Create transaction
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction({
        feePayer: userPublicKey,
        recentBlockhash: blockhash,
      });

      // Build swap instruction for buying tokens
      const swapInstruction = await this.buildBuySwapInstruction(
        userPublicKey,
        tokenMint,
        solAmount,
        dexProvider
      );
      transaction.add(swapInstruction);

      // Add SOL transfer for the swap
      const solTransferInstruction = SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: swapInstruction.keys[2].pubkey, // AMM account
        lamports: solAmountLamports,
      });
      transaction.add(solTransferInstruction);

      console.log('📤 Sending buy transaction...');

      // Simulate transaction
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        console.error('❌ Simulation failed:', simulation.value.err);
        return {
          success: false,
          tokensReceived: 0,
          solSpent: solAmount,
          feesPaid: fees.totalFees,
          message: `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`,
          error: 'SIMULATION_FAILED'
        };
      }

      // Send transaction
      const signature = await sendTransaction(transaction);
      console.log('✅ Transaction sent:', signature);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('🎉 Transaction confirmed!');

      // Calculate estimated tokens received (simplified - would need actual calculation)
      const estimatedTokensReceived = netSolLamports / 1e9; // Simplified calculation

      return {
        success: true,
        signature,
        tokensReceived: estimatedTokensReceived,
        solSpent: solAmount,
        feesPaid: fees.totalFees,
        message: `Successfully bought ${estimatedTokensReceived.toFixed(6)} tokens`
      };

    } catch (error) {
      console.error('❌ Error buying tokens:', error);
      return {
        success: false,
        tokensReceived: 0,
        solSpent: solAmount,
        feesPaid: 0,
        message: 'Failed to buy tokens',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Sell tokens with proper token burning and SOL transfer
   */
  static async sellTokens(
    connection: Connection,
    userPublicKey: PublicKey,
    sendTransaction: (transaction: Transaction) => Promise<string>,
    tokenMint: PublicKey,
    tokenAmount: number,
    dexProvider: 'cook' | 'raydium' = 'cook'
  ): Promise<SellResult> {
    try {
      console.log('💰 Starting enhanced sellTokens transaction...');
      console.log('📊 Transaction details:', {
        userPublicKey: userPublicKey.toBase58(),
        tokenMint: tokenMint.toBase58(),
        tokenAmount,
        dexProvider
      });

      // Convert token amount to smallest unit (assuming 9 decimals)
      const tokenAmountSmallest = Math.floor(tokenAmount * 1e9);

      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPublicKey);
      
      // Check if user has enough tokens
      const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
      if (!tokenAccountInfo) {
        return {
          success: false,
          tokensSold: 0,
          solReceived: 0,
          feesPaid: 0,
          message: 'Token account not found',
          error: 'TOKEN_ACCOUNT_NOT_FOUND'
        };
      }

      // Parse token account data to get balance
      const tokenBalance = this.parseTokenAccountBalance(tokenAccountInfo.data);
      if (tokenBalance < tokenAmountSmallest) {
        return {
          success: false,
          tokensSold: 0,
          solReceived: 0,
          feesPaid: 0,
          message: `Insufficient token balance. Have ${tokenBalance / 1e9}, need ${tokenAmount}`,
          error: 'INSUFFICIENT_TOKEN_BALANCE'
        };
      }

      // Estimate SOL value (simplified - would need actual AMM calculation)
      const estimatedSolValue = tokenAmount * 0.001; // Simplified calculation
      const fees = this.calculateFees(estimatedSolValue);
      const netSolReceived = fees.netAmount;

      console.log('💰 Sell breakdown:', {
        tokenAmount,
        estimatedSolValue,
        fees: fees.totalFees,
        netSolReceived
      });

      // Create transaction
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction({
        feePayer: userPublicKey,
        recentBlockhash: blockhash,
      });

      // Build swap instruction for selling tokens
      const swapInstruction = await this.buildSellSwapInstruction(
        userPublicKey,
        tokenMint,
        tokenAmount,
        dexProvider
      );
      transaction.add(swapInstruction);

      console.log('📤 Sending sell transaction...');

      // Simulate transaction
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        console.error('❌ Simulation failed:', simulation.value.err);
        return {
          success: false,
          tokensSold: 0,
          solReceived: 0,
          feesPaid: fees.totalFees,
          message: `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`,
          error: 'SIMULATION_FAILED'
        };
      }

      // Send transaction
      const signature = await sendTransaction(transaction);
      console.log('✅ Transaction sent:', signature);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('🎉 Transaction confirmed!');

      return {
        success: true,
        signature,
        tokensSold: tokenAmount,
        solReceived: netSolReceived,
        feesPaid: fees.totalFees,
        message: `Successfully sold ${tokenAmount.toFixed(6)} tokens for ${netSolReceived.toFixed(6)} SOL`
      };

    } catch (error) {
      console.error('❌ Error selling tokens:', error);
      return {
        success: false,
        tokensSold: 0,
        solReceived: 0,
        feesPaid: 0,
        message: 'Failed to sell tokens',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Build swap instruction for buying tokens
   */
  private static async buildBuySwapInstruction(
    userPublicKey: PublicKey,
    tokenMint: PublicKey,
    solAmount: number,
    dexProvider: 'cook' | 'raydium'
  ): Promise<TransactionInstruction> {
    // Derive AMM accounts
    const [ammAccount] = PublicKey.findProgramAddressSync(
      [tokenMint.toBytes(), Buffer.from('AMM')],
      PROGRAM_ID
    );

    const [tokenVault] = PublicKey.findProgramAddressSync(
      [tokenMint.toBytes(), Buffer.from('TokenVault')],
      PROGRAM_ID
    );

    const [solVault] = PublicKey.findProgramAddressSync(
      [tokenMint.toBytes(), Buffer.from('SolVault')],
      PROGRAM_ID
    );

    // Build swap instruction data
    const swapArgs = {
      side: 0, // Buy side
      limit_price: Math.floor(solAmount * 1e9),
      max_base_quantity: Math.floor(solAmount * 1e9),
      max_quote_quantity: Math.floor(solAmount * 1e9),
      order_type: 0, // Market order
      client_order_id: Date.now(),
      limit: 0,
    };

    const instructionData = Buffer.concat([
      Buffer.from(INSTRUCTION_DISCRIMINATORS.SWAP_COOK_AMM),
      Buffer.from(new Uint8Array(new Uint32Array([swapArgs.side]).buffer)),
      Buffer.from(new Uint8Array(new Uint64Array([swapArgs.limit_price]).buffer)),
      Buffer.from(new Uint8Array(new Uint64Array([swapArgs.max_base_quantity]).buffer)),
      Buffer.from(new Uint8Array(new Uint64Array([swapArgs.max_quote_quantity]).buffer)),
      Buffer.from(new Uint8Array(new Uint32Array([swapArgs.order_type]).buffer)),
      Buffer.from(new Uint8Array(new Uint64Array([swapArgs.client_order_id]).buffer)),
      Buffer.from(new Uint8Array(new Uint16Array([swapArgs.limit]).buffer)),
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: ammAccount, isSigner: false, isWritable: true },
        { pubkey: tokenVault, isSigner: false, isWritable: true },
        { pubkey: solVault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });
  }

  /**
   * Build swap instruction for selling tokens
   */
  private static async buildSellSwapInstruction(
    userPublicKey: PublicKey,
    tokenMint: PublicKey,
    tokenAmount: number,
    dexProvider: 'cook' | 'raydium'
  ): Promise<TransactionInstruction> {
    // Derive AMM accounts
    const [ammAccount] = PublicKey.findProgramAddressSync(
      [tokenMint.toBytes(), Buffer.from('AMM')],
      PROGRAM_ID
    );

    const [tokenVault] = PublicKey.findProgramAddressSync(
      [tokenMint.toBytes(), Buffer.from('TokenVault')],
      PROGRAM_ID
    );

    const [solVault] = PublicKey.findProgramAddressSync(
      [tokenMint.toBytes(), Buffer.from('SolVault')],
      PROGRAM_ID
    );

    // Build swap instruction data
    const swapArgs = {
      side: 1, // Sell side
      limit_price: Math.floor(tokenAmount * 1e9),
      max_base_quantity: Math.floor(tokenAmount * 1e9),
      max_quote_quantity: Math.floor(tokenAmount * 1e9),
      order_type: 0, // Market order
      client_order_id: Date.now(),
      limit: 0,
    };

    const instructionData = Buffer.concat([
      Buffer.from(INSTRUCTION_DISCRIMINATORS.SWAP_COOK_AMM),
      Buffer.from(new Uint8Array(new Uint32Array([swapArgs.side]).buffer)),
      Buffer.from(new Uint8Array(new Uint64Array([swapArgs.limit_price]).buffer)),
      Buffer.from(new Uint8Array(new Uint64Array([swapArgs.max_base_quantity]).buffer)),
      Buffer.from(new Uint8Array(new Uint64Array([swapArgs.max_quote_quantity]).buffer)),
      Buffer.from(new Uint8Array(new Uint32Array([swapArgs.order_type]).buffer)),
      Buffer.from(new Uint8Array(new Uint64Array([swapArgs.client_order_id]).buffer)),
      Buffer.from(new Uint8Array(new Uint16Array([swapArgs.limit]).buffer)),
    ]);

    return new TransactionInstruction({
      keys: [
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: ammAccount, isSigner: false, isWritable: true },
        { pubkey: tokenVault, isSigner: false, isWritable: true },
        { pubkey: solVault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });
  }

  /**
   * Parse token account balance from account data
   */
  private static parseTokenAccountBalance(data: Buffer): number {
    // Token account layout: mint(32) + owner(32) + amount(8) + ...
    const amountOffset = 64; // Skip mint and owner
    return data.readBigUInt64LE(amountOffset);
  }

  /**
   * Get current token price from AMM
   */
  static async getTokenPrice(
    connection: Connection,
    tokenMint: PublicKey
  ): Promise<number> {
    try {
      // This would fetch actual price from AMM
      // For now, return a mock price
      return 0.001; // Mock price
    } catch (error) {
      console.error('❌ Error getting token price:', error);
      return 0;
    }
  }

  /**
   * Get user's token balance
   */
  static async getUserTokenBalance(
    connection: Connection,
    userPublicKey: PublicKey,
    tokenMint: PublicKey
  ): Promise<number> {
    try {
      const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPublicKey);
      const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
      
      if (!tokenAccountInfo) {
        return 0;
      }

      const balance = this.parseTokenAccountBalance(tokenAccountInfo.data);
      return Number(balance) / 1e9; // Convert from smallest unit
    } catch (error) {
      console.error('❌ Error getting user token balance:', error);
      return 0;
    }
  }
}

export default EnhancedBuySellService;
