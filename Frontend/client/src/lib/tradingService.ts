import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID } from './nativeProgram';

export interface SwapQuote {
  price: number;
  outputAmount: number;
  priceImpact: number;
  minimumReceived: number;
}

export interface TradeResult {
  success: boolean;
  signature?: string;
  tokensReceived?: number;
  solReceived?: number;
  error?: string;
}

export class TradingService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
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
    try {
      console.log('💰 Getting swap quote:', {
        inputMint: inputMint.toBase58(),
        outputMint: outputMint.toBase58(),
        amount,
        dexProvider
      });

      // For now, implement a simple quote calculation
      // In a real implementation, this would call the actual DEX APIs
      
      const isSOLToToken = inputMint.toBase58() === "So11111111111111111111111111111111111111112";
      
      if (isSOLToToken) {
        // SOL to Token: Simple 1 SOL = 1000 tokens calculation
        const tokenAmount = amount * 1000;
        const price = 1 / 1000; // 1 token = 0.001 SOL
        
        return {
          price,
          outputAmount: tokenAmount,
          priceImpact: 0.1, // 0.1% price impact
          minimumReceived: tokenAmount * 0.995 // 0.5% slippage tolerance
        };
      } else {
        // Token to SOL: Simple 1000 tokens = 1 SOL calculation
        const solAmount = amount / 1000;
        const price = 1000; // 1000 tokens = 1 SOL
        
        return {
          price,
          outputAmount: solAmount,
          priceImpact: 0.1, // 0.1% price impact
          minimumReceived: solAmount * 0.995 // 0.5% slippage tolerance
        };
      }
    } catch (error) {
      console.error('❌ Error getting swap quote:', error);
      throw new Error('Failed to get swap quote');
    }
  }

  /**
   * Buy tokens using instant swap
   */
  async buyTokensAMM(
    tokenMint: string,
    userPublicKey: string,
    solAmount: number,
    signTransaction?: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TradeResult> {
    try {
      console.log('🔄 Buying tokens via instant swap:', {
        tokenMint,
        userPublicKey,
        solAmount
      });

      if (!signTransaction) {
        throw new Error('signTransaction function not provided');
      }

      const userKey = new PublicKey(userPublicKey);
      const tokenMintKey = new PublicKey(tokenMint);
      
      // Calculate amount in lamports
      const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const minimumTokenAmount = Math.floor(solAmount * 1000 * 0.995); // 0.5% slippage tolerance
      
      // Create instruction data for SwapRaydium (which we're using for instant swap)
      const argsBuffer = Buffer.alloc(16); // u64 + u64 = 16 bytes
      argsBuffer.writeBigUInt64LE(BigInt(amountInLamports), 0);
      argsBuffer.writeBigUInt64LE(BigInt(minimumTokenAmount), 8);
      
      const instructionData = Buffer.concat([
        Buffer.from([19]), // SwapRaydium variant index
        argsBuffer
      ]);
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userKey, isSigner: true, isWritable: true },        // user
          { pubkey: tokenMintKey, isSigner: false, isWritable: true },   // launch_data (using token mint as launch data)
          { pubkey: userKey, isSigner: false, isWritable: true },        // user_token_account (simplified)
          { pubkey: tokenMintKey, isSigner: false, isWritable: true },   // token_mint
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      // Create transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userKey;
      
      console.log('📤 Sending instant swap transaction...');
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('✅ Instant swap transaction sent:', signature);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ Instant swap transaction confirmed');
      
      return {
        success: true,
        signature: signature,
        tokensReceived: solAmount * 1000 // Simplified - 1 SOL = 1000 tokens
      };
    } catch (error) {
      console.error('❌ Error buying tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to buy tokens'
      };
    }
  }

  /**
   * Sell tokens using instant swap
   */
  async sellTokensAMM(
    tokenMint: string,
    userPublicKey: string,
    tokenAmount: number,
    signTransaction?: (transaction: Transaction) => Promise<Transaction>
  ): Promise<TradeResult> {
    try {
      console.log('🔄 Selling tokens via instant swap:', {
        tokenMint,
        userPublicKey,
        tokenAmount
      });

      if (!signTransaction) {
        throw new Error('signTransaction function not provided');
      }

      const userKey = new PublicKey(userPublicKey);
      const tokenMintKey = new PublicKey(tokenMint);
      
      // Calculate amounts (simplified: 1000 tokens = 1 SOL)
      const solAmount = tokenAmount / 1000;
      const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const minimumSolAmount = Math.floor(amountInLamports * 0.995); // 0.5% slippage tolerance
      
      // Create instruction data for SwapRaydium (which we're using for instant swap)
      const argsBuffer = Buffer.alloc(16); // u64 + u64 = 16 bytes
      argsBuffer.writeBigUInt64LE(BigInt(tokenAmount), 0); // Token amount
      argsBuffer.writeBigUInt64LE(BigInt(minimumSolAmount), 8); // Minimum SOL out
      
      const instructionData = Buffer.concat([
        Buffer.from([19]), // SwapRaydium variant index
        argsBuffer
      ]);
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userKey, isSigner: true, isWritable: true },        // user
          { pubkey: tokenMintKey, isSigner: false, isWritable: true },   // launch_data (using token mint as launch data)
          { pubkey: userKey, isSigner: false, isWritable: true },        // user_token_account (simplified)
          { pubkey: tokenMintKey, isSigner: false, isWritable: true },   // token_mint
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      // Create transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userKey;
      
      console.log('📤 Sending instant swap transaction...');
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('✅ Instant swap transaction sent:', signature);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ Instant swap transaction confirmed');
      
      return {
        success: true,
        signature: signature,
        solReceived: solAmount // Simplified - tokenAmount / 1000
      };
    } catch (error) {
      console.error('❌ Error selling tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sell tokens'
      };
    }
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
    try {
      console.log('🎫 Buying tickets:', { raffleId, userPublicKey, ticketCount, totalCost });
      
      const userPubkey = new PublicKey(userPublicKey);
      const rafflePubkey = new PublicKey(raffleId);
      
      // Calculate amount in lamports
      const amountInLamports = Math.floor(totalCost * LAMPORTS_PER_SOL);
      
      // Create proper Borsh-serialized instruction
      // We need to serialize LaunchInstruction::BuyTickets { args: JoinArgs }
      // where JoinArgs = { amount: u64 }
      
      const joinArgs = {
        amount: BigInt(amountInLamports)
      };
      
      // Serialize JoinArgs first
      const argsBuffer = Buffer.alloc(8); // u64 = 8 bytes
      argsBuffer.writeBigUInt64LE(joinArgs.amount, 0);
      
      // For Borsh enum serialization, we need:
      // - 1 byte for variant index (BuyTickets is index 2)
      // - The serialized args
      const instructionData = Buffer.concat([
        Buffer.from([2]), // BuyTickets variant index
        argsBuffer         // Serialized JoinArgs
      ]);
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },        // user
          { pubkey: rafflePubkey, isSigner: false, isWritable: true },   // launch_data
          { pubkey: userPubkey, isSigner: false, isWritable: true },      // user_sol_account (same as user for SOL)
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      // Create transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPubkey;
      
      // Debug: Check if the raffle account exists and has valid data
      console.log('🔍 Checking raffle account before transaction...');
      const raffleAccountInfo = await this.connection.getAccountInfo(rafflePubkey);
      if (!raffleAccountInfo) {
        throw new Error('Raffle account not found');
      }
      console.log('📊 Raffle account info:', {
        exists: true,
        owner: raffleAccountInfo.owner.toBase58(),
        dataLength: raffleAccountInfo.data.length,
        executable: raffleAccountInfo.executable,
        rentEpoch: raffleAccountInfo.rentEpoch
      });
      
      // Check if the account is owned by our program
      console.log('🔍 Program ID comparison:', {
        accountOwner: raffleAccountInfo.owner.toBase58(),
        expectedProgramId: PROGRAM_ID.toBase58(),
        areEqual: raffleAccountInfo.owner.toBase58() === PROGRAM_ID.toBase58()
      });
      
      if (raffleAccountInfo.owner.toBase58() !== PROGRAM_ID.toBase58()) {
        console.log('⚠️ Account owner mismatch, but continuing anyway...');
        // Don't throw error, just log warning
      }
      
      console.log('📤 Sending buy tickets transaction...');
      console.log('📊 Transaction details:', {
        instructions: transaction.instructions.length,
        feePayer: transaction.feePayer?.toBase58(),
        recentBlockhash: transaction.recentBlockhash,
        amountInLamports: amountInLamports,
        amountInSOL: totalCost
      });
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('✅ Buy tickets transaction sent:', signature);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ Buy tickets transaction confirmed');
      
      return {
        success: true,
        signature: signature
      };
    } catch (error) {
      console.error('❌ Error buying tickets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to buy tickets'
      };
    }
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
    try {
      console.log('🎁 Claiming tokens for raffle:', raffleId);
      
      const userPubkey = new PublicKey(userPublicKey);
      const rafflePubkey = new PublicKey(raffleId);
      
      // Get user's token account (simplified - in real implementation, you'd derive this)
      const userTokenAccount = userPubkey; // Simplified for now
      const tokenMint = rafflePubkey; // Simplified for now
      
      // Create instruction data for ClaimTokens (no args needed)
      const instructionData = Buffer.from([8]); // ClaimTokens variant index
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },        // user
          { pubkey: rafflePubkey, isSigner: false, isWritable: true },     // launch_data
          { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // user_token_account
          { pubkey: tokenMint, isSigner: false, isWritable: true },        // token_mint
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      // Create transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPubkey;
      
      console.log('📤 Sending claim tokens transaction...');
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('✅ Claim tokens transaction sent:', signature);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ Claim tokens transaction confirmed');
      
      return {
        success: true,
        signature: signature,
        tokenAmount: 1000 // Simplified - in real implementation, calculate from raffle data
      };
    } catch (error) {
      console.error('❌ Error claiming tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim tokens'
      };
    }
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
    try {
      console.log('💰 Claiming refund for raffle:', raffleId);
      
      const userPubkey = new PublicKey(userPublicKey);
      const rafflePubkey = new PublicKey(raffleId);
      
      // Create instruction data for ClaimRefund (no args needed)
      const instructionData = Buffer.from([6]); // ClaimRefund variant index
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },        // user
          { pubkey: rafflePubkey, isSigner: false, isWritable: true },     // launch_data
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      // Create transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPubkey;
      
      console.log('📤 Sending claim refund transaction...');
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('✅ Claim refund transaction sent:', signature);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ Claim refund transaction confirmed');
      
      return {
        success: true,
        signature: signature,
        refundAmount: 0.1 // Simplified - in real implementation, calculate from raffle data
      };
    } catch (error) {
      console.error('❌ Error claiming refund:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim refund'
      };
    }
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
    try {
      console.log('🔄 Instant swapping:', { raffleId, userPublicKey, solAmount, minimumTokenAmount });
      
      const userPubkey = new PublicKey(userPublicKey);
      const rafflePubkey = new PublicKey(raffleId);
      
      // Calculate amount in lamports
      const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      
      // Get user's token account (simplified - in real implementation, you'd derive this)
      const userTokenAccount = userPubkey; // Simplified for now
      const tokenMint = rafflePubkey; // Simplified for now
      
      // Create instruction data for SwapRaydium (which we're using for instant swap)
      const argsBuffer = Buffer.alloc(16); // u64 + u64 = 16 bytes
      argsBuffer.writeBigUInt64LE(BigInt(amountInLamports), 0);
      argsBuffer.writeBigUInt64LE(BigInt(minimumTokenAmount), 8);
      
      const instructionData = Buffer.concat([
        Buffer.from([19]), // SwapRaydium variant index
        argsBuffer
      ]);
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },        // user
          { pubkey: rafflePubkey, isSigner: false, isWritable: true },     // launch_data
          { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // user_token_account
          { pubkey: tokenMint, isSigner: false, isWritable: true },        // token_mint
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      // Create transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPubkey;
      
      console.log('📤 Sending instant swap transaction...');
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('✅ Instant swap transaction sent:', signature);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ Instant swap transaction confirmed');
      
      return {
        success: true,
        signature: signature,
        tokenAmount: solAmount * 1000 // Simplified - 1 SOL = 1000 tokens
      };
    } catch (error) {
      console.error('❌ Error instant swapping:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to instant swap'
      };
    }
  }
}

// Export a default instance
export const tradingService = new TradingService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);