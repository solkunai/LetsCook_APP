import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import { getConnection } from './connection';

// Raydium Program IDs
const RAYDIUM_AMM_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const RAYDIUM_CLMM = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export interface RaydiumPoolInfo {
  poolAddress: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  lpMint: PublicKey;
  baseReserve: bigint;
  quoteReserve: bigint;
  price: number;
}

export interface SwapQuote {
  inputAmount: bigint;
  outputAmount: bigint;
  priceImpact: number;
  fee: bigint;
}

export class RaydiumService {
  private connection: Connection;

  constructor(connection?: Connection) {
    this.connection = connection || getConnection('confirmed');
  }

  /**
   * Find or create a Raydium AMM pool for a token pair
   */
  async findOrCreatePool(
    baseMint: PublicKey,
    quoteMint: PublicKey = WSOL_MINT,
    payer: PublicKey
  ): Promise<PublicKey | null> {
    try {
      // Try to find existing pool
      const poolAddress = await this.findPool(baseMint, quoteMint);
      if (poolAddress) {
        console.log('✅ Found existing Raydium pool:', poolAddress.toBase58());
        return poolAddress;
      }

      // Pool doesn't exist - would need to create it
      // For now, return null as pool creation requires more complex setup
      console.warn('⚠️ Pool not found. Pool creation requires additional setup.');
      return null;
    } catch (error) {
      console.error('❌ Error finding/creating pool:', error);
      return null;
    }
  }

  /**
   * Find existing Raydium pool
   */
  async findPool(
    baseMint: PublicKey,
    quoteMint: PublicKey = WSOL_MINT
  ): Promise<PublicKey | null> {
    try {
      // Search for pool accounts owned by Raydium
      const programAccounts = await this.connection.getProgramAccounts(RAYDIUM_AMM_V4, {
        filters: [
          {
            dataSize: 752, // Standard Raydium AMM pool account size
          },
        ],
      });

      // Parse accounts to find matching mints
      for (const { pubkey, account } of programAccounts) {
        try {
          const data = account.data;
          // Raydium pool structure: baseMint at offset 129, quoteMint at offset 161
          const poolBaseMint = new PublicKey(data.slice(129, 161));
          const poolQuoteMint = new PublicKey(data.slice(161, 193));

          if (
            (poolBaseMint.equals(baseMint) && poolQuoteMint.equals(quoteMint)) ||
            (poolBaseMint.equals(quoteMint) && poolQuoteMint.equals(baseMint))
          ) {
            return pubkey;
          }
        } catch (e) {
          // Skip invalid accounts
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error finding pool:', error);
      return null;
    }
  }

  /**
   * Get pool information
   */
  async getPoolInfo(poolAddress: PublicKey): Promise<RaydiumPoolInfo | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(poolAddress);
      if (!accountInfo) return null;

      const data = accountInfo.data;
      
      // Parse Raydium pool structure
      // Base mint at offset 129, quote mint at offset 161
      const baseMint = new PublicKey(data.slice(129, 161));
      const quoteMint = new PublicKey(data.slice(161, 193));
      
      // Base vault at offset 193, quote vault at offset 225
      const baseVault = new PublicKey(data.slice(193, 225));
      const quoteVault = new PublicKey(data.slice(225, 257));
      
      // LP mint at offset 97
      const lpMint = new PublicKey(data.slice(97, 129));

      // Get reserves from vault accounts
      const baseVaultInfo = await getAccount(this.connection, baseVault);
      const quoteVaultInfo = await getAccount(this.connection, quoteVault);

      const baseReserve = BigInt(baseVaultInfo.amount.toString());
      const quoteReserve = BigInt(quoteVaultInfo.amount.toString());

      // Calculate price (quote per base)
      const price = baseReserve > 0n 
        ? Number(quoteReserve) / Number(baseReserve)
        : 0;

      return {
        poolAddress,
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
        lpMint,
        baseReserve,
        quoteReserve,
        price,
      };
    } catch (error) {
      console.error('❌ Error getting pool info:', error);
      return null;
    }
  }

  /**
   * Get swap quote
   */
  async getSwapQuote(
    poolAddress: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    slippageBps: number = 50 // 0.5% default slippage
  ): Promise<SwapQuote | null> {
    try {
      const poolInfo = await this.getPoolInfo(poolAddress);
      if (!poolInfo) return null;

      const isBaseToQuote = poolInfo.baseMint.equals(inputMint);
      const reserveIn = isBaseToQuote ? poolInfo.baseReserve : poolInfo.quoteReserve;
      const reserveOut = isBaseToQuote ? poolInfo.quoteReserve : poolInfo.baseReserve;

      if (reserveIn === 0n || reserveOut === 0n) {
        return null;
      }

      // Constant product formula: (x + dx) * (y - dy) = x * y
      // Raydium fee: 0.25% (25 bps)
      const feeBps = 25;
      const amountInWithFee = amountIn * BigInt(10000 - feeBps) / 10000n;
      
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn + amountInWithFee;
      const amountOut = numerator / denominator;

      // Calculate price impact
      const priceBefore = Number(reserveOut) / Number(reserveIn);
      const newReserveIn = reserveIn + amountIn;
      const newReserveOut = reserveOut - amountOut;
      const priceAfter = Number(newReserveOut) / Number(newReserveIn);
      const priceImpact = Math.abs((priceAfter - priceBefore) / priceBefore) * 100;

      // Apply slippage tolerance
      const minAmountOut = amountOut * BigInt(10000 - slippageBps) / 10000n;
      const fee = amountIn * BigInt(feeBps) / 10000n;

      return {
        inputAmount: amountIn,
        outputAmount: amountOut,
        priceImpact,
        fee,
      };
    } catch (error) {
      console.error('❌ Error getting swap quote:', error);
      return null;
    }
  }

  /**
   * Execute a swap on Raydium
   */
  async swap(
    poolAddress: PublicKey,
    user: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    minAmountOut: bigint,
    signTransaction: (tx: Transaction) => Promise<Transaction>
  ): Promise<string> {
    try {
      const poolInfo = await this.getPoolInfo(poolAddress);
      if (!poolInfo) {
        throw new Error('Pool not found');
      }

      const isBaseToQuote = poolInfo.baseMint.equals(inputMint);
      const userInputAccount = await getAssociatedTokenAddress(inputMint, user);
      const userOutputAccount = await getAssociatedTokenAddress(outputMint, user);

      // Check if accounts exist, create if needed
      const transaction = new Transaction();

      try {
        await getAccount(this.connection, userInputAccount);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            user,
            userInputAccount,
            user,
            inputMint
          )
        );
      }

      try {
        await getAccount(this.connection, userOutputAccount);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            user,
            userOutputAccount,
            user,
            outputMint
          )
        );
      }

      // Create Raydium swap instruction
      // Raydium AMM V4 swap instruction discriminator: 9
      const instructionData = Buffer.alloc(17);
      instructionData.writeUInt8(9, 0); // Swap instruction
      instructionData.writeUInt8(isBaseToQuote ? 0 : 1, 1); // Direction
      instructionData.writeBigUInt64LE(amountIn, 2);
      instructionData.writeBigUInt64LE(minAmountOut, 10);

      const swapInstruction = new TransactionInstruction({
        keys: [
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: poolAddress, isSigner: false, isWritable: true },
          { pubkey: userInputAccount, isSigner: false, isWritable: true },
          { pubkey: userOutputAccount, isSigner: false, isWritable: true },
          { pubkey: isBaseToQuote ? poolInfo.baseVault : poolInfo.quoteVault, isSigner: false, isWritable: true },
          { pubkey: isBaseToQuote ? poolInfo.quoteVault : poolInfo.baseVault, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: RAYDIUM_AMM_V4,
        data: instructionData,
      });

      transaction.add(swapInstruction);

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = user;

      const signed = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signed.serialize());
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      return signature;
    } catch (error) {
      console.error('❌ Error executing swap:', error);
      throw error;
    }
  }

  /**
   * Add liquidity to Raydium pool
   */
  async addLiquidity(
    poolAddress: PublicKey,
    user: PublicKey,
    baseAmount: bigint,
    quoteAmount: bigint,
    signTransaction: (tx: Transaction) => Promise<Transaction>
  ): Promise<string> {
    try {
      const poolInfo = await this.getPoolInfo(poolAddress);
      if (!poolInfo) {
        throw new Error('Pool not found');
      }

      const userBaseAccount = await getAssociatedTokenAddress(poolInfo.baseMint, user);
      const userQuoteAccount = await getAssociatedTokenAddress(poolInfo.quoteMint, user);

      const transaction = new Transaction();

      // Ensure accounts exist
      try {
        await getAccount(this.connection, userBaseAccount);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            user,
            userBaseAccount,
            user,
            poolInfo.baseMint
          )
        );
      }

      try {
        await getAccount(this.connection, userQuoteAccount);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            user,
            userQuoteAccount,
            user,
            poolInfo.quoteMint
          )
        );
      }

      // Raydium add liquidity instruction discriminator: 3
      const instructionData = Buffer.alloc(17);
      instructionData.writeUInt8(3, 0);
      instructionData.writeBigUInt64LE(baseAmount, 1);
      instructionData.writeBigUInt64LE(quoteAmount, 9);

      const addLiquidityInstruction = new TransactionInstruction({
        keys: [
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: poolAddress, isSigner: false, isWritable: true },
          { pubkey: userBaseAccount, isSigner: false, isWritable: true },
          { pubkey: userQuoteAccount, isSigner: false, isWritable: true },
          { pubkey: poolInfo.baseVault, isSigner: false, isWritable: true },
          { pubkey: poolInfo.quoteVault, isSigner: false, isWritable: true },
          { pubkey: poolInfo.lpMint, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: RAYDIUM_AMM_V4,
        data: instructionData,
      });

      transaction.add(addLiquidityInstruction);

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = user;

      const signed = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signed.serialize());
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      return signature;
    } catch (error) {
      console.error('❌ Error adding liquidity:', error);
      throw error;
    }
  }

  /**
   * Get current price for a token
   */
  async getTokenPrice(tokenMint: PublicKey): Promise<number | null> {
    try {
      const poolAddress = await this.findPool(tokenMint, WSOL_MINT);
      if (!poolAddress) return null;

      const poolInfo = await this.getPoolInfo(poolAddress);
      if (!poolInfo) return null;

      return poolInfo.price;
    } catch (error) {
      console.error('❌ Error getting token price:', error);
      return null;
    }
  }
}

// Export singleton instance
export const raydiumService = new RaydiumService();



