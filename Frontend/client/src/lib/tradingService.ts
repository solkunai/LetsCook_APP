import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID } from './nativeProgram';

// Standard Solana Associated Token Program ID
const ASSOCIATED_TOKEN_PROGRAM_ID_STANDARD = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

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

  // Helper method to ensure token account exists
  private async ensureTokenAccountExists(
    tokenMint: PublicKey,
    userPublicKey: PublicKey,
    transaction: Transaction
  ): Promise<PublicKey> {
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPublicKey);
    
    try {
      const accountInfo = await this.connection.getAccountInfo(userTokenAccount);
      if (!accountInfo) {
        console.log('🔄 Creating associated token account...');
        // Create the associated token account (uses standard token program by default)
        const createAccountInstruction = createAssociatedTokenAccountInstruction(
          userPublicKey, // payer
          userTokenAccount, // associatedToken
          userPublicKey, // owner
          tokenMint // mint
        );
        transaction.add(createAccountInstruction);
        console.log('✅ Added token account creation instruction');
      } else {
        console.log('✅ Token account already exists');
      }
    } catch (error) {
      console.warn('Error checking token account, will attempt to create:', error);
      // Add create instruction anyway
      const createAccountInstruction = createAssociatedTokenAccountInstruction(
        userPublicKey, // payer
        userTokenAccount, // associatedToken
        userPublicKey, // owner
        tokenMint // mint
      );
      transaction.add(createAccountInstruction);
    }
    
    return userTokenAccount;
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
    signTransaction?: (transaction: Transaction) => Promise<Transaction>,
    dexProvider: 'cook' | 'raydium' = 'raydium'
  ): Promise<TradeResult> {
    try {
      console.log('🔄 Buying tokens via instant swap:', {
        tokenMint,
        userPublicKey,
        solAmount,
        dexProvider
      });

      if (!signTransaction) {
        throw new Error('signTransaction function not provided');
      }

      const userKey = new PublicKey(userPublicKey);
      let tokenMintKey = new PublicKey(tokenMint);
      
      // Check if the provided tokenMint is actually an SPL token mint
      console.log('🔍 Checking if tokenMint is a real SPL token mint...');
      const mintAccountInfo = await this.connection.getAccountInfo(tokenMintKey);
      const isRealTokenMint = mintAccountInfo?.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58();
      
      console.log('📊 Token mint analysis:', {
        address: tokenMintKey.toBase58(),
        owner: mintAccountInfo?.owner.toBase58(),
        isSPLToken: isRealTokenMint,
        expectedOwner: TOKEN_PROGRAM_ID.toBase58()
      });
      
      if (!isRealTokenMint) {
        console.log('⚠️ Provided tokenMint is not an SPL token mint. This is likely a launch account.');
        console.log('🔄 Attempting to derive the actual token mint from launch data...');
        
        // Try to get the actual token mint from the launch account
        const actualTokenMint = await this.getActualTokenMintFromLaunch(tokenMintKey);
        if (actualTokenMint) {
          console.log('✅ Found actual SPL token mint:', actualTokenMint.toBase58());
          // Update tokenMintKey to use the actual SPL token mint
          tokenMintKey = actualTokenMint;
          // Re-check if it's a real SPL token mint
          const actualMintInfo = await this.connection.getAccountInfo(actualTokenMint);
          const isActualSPLToken = actualMintInfo?.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58();
          if (!isActualSPLToken) {
            throw new Error('Derived token mint is still not an SPL token mint');
          }
          console.log('✅ Verified actual token mint is SPL token');
        } else {
          throw new Error('Could not derive actual token mint from launch account');
        }
      }
      
      // Calculate amount in lamports
      const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const minimumTokenAmount = Math.floor(solAmount * 1000 * 0.995); // 0.5% slippage tolerance
      
      // Derive the correct accounts for SwapRaydium
      const [launchDataAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('launch'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      const [ammAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      // Create transaction
      const transaction = new Transaction();
      
      // Only create ATA if we have a real token mint
      let userTokenAccount: PublicKey;
      if (isRealTokenMint) {
        userTokenAccount = await this.ensureTokenAccountExists(
          tokenMintKey,
          userKey,
          transaction
        );
      } else {
        // For non-SPL accounts, derive the ATA address but don't create it
        userTokenAccount = await getAssociatedTokenAddress(tokenMintKey, userKey);
        console.log('📝 Using derived ATA address without creation:', userTokenAccount.toBase58());
      }
      
      // Create instruction data based on DEX provider
      let instructionData: Buffer;
      
      // TEMPORARY: Force Raydium to test if the issue is with CookDEX specifically
      console.log('🧪 TEMPORARY: Forcing Raydium to test if CookDEX is the issue');
      
      if (true || dexProvider === 'cook') { // Force Raydium for now
        // Use SwapRaydium instruction (variant 21)
        const argsBuffer = Buffer.alloc(16); // u64 + u64 = 16 bytes
        argsBuffer.writeBigUInt64LE(BigInt(amountInLamports), 0);
        argsBuffer.writeBigUInt64LE(BigInt(minimumTokenAmount), 8);
        
        instructionData = Buffer.concat([
          Buffer.from([21]), // SwapRaydium variant index
          argsBuffer
        ]);
        console.log('⚡ Using Raydium SwapRaydium instruction (forced)');
      } else {
        // Use SwapRaydium instruction (variant 21)
        const argsBuffer = Buffer.alloc(16); // u64 + u64 = 16 bytes
        argsBuffer.writeBigUInt64LE(BigInt(amountInLamports), 0);
        argsBuffer.writeBigUInt64LE(BigInt(minimumTokenAmount), 8);
        
        instructionData = Buffer.concat([
          Buffer.from([21]), // SwapRaydium variant index
          argsBuffer
        ]);
        console.log('⚡ Using Raydium SwapRaydium instruction');
      }
      
      // Derive Raydium pool accounts
      const [poolStateAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool_state'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      const [poolAuthorityAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('pool_authority'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      // For SOL input, user's SOL account is the same as user key
      const userSolAccount = userKey;
      
      // Pool SOL account (AMM's SOL account)
      const poolSolAccount = ammAccount;
      
      // Pool token account (AMM's token account)
      const poolTokenAccount = await getAssociatedTokenAddress(tokenMintKey, ammAccount);

      // Debug: Check if accounts exist
      console.log('🔍 Checking account existence...');
      
      const accountChecks = await Promise.all([
        this.connection.getAccountInfo(userKey),
        this.connection.getAccountInfo(tokenMintKey),
        this.connection.getAccountInfo(ammAccount),
        this.connection.getAccountInfo(userTokenAccount),
        this.connection.getAccountInfo(launchDataAccount),
        this.connection.getAccountInfo(poolStateAccount),
        this.connection.getAccountInfo(poolAuthorityAccount),
        this.connection.getAccountInfo(poolTokenAccount)
      ]);
      
      console.log('🔍 Account Debug Info:', {
        userKey: userKey.toBase58(),
        userKeyExists: !!accountChecks[0],
        tokenMintKey: tokenMintKey.toBase58(),
        tokenMintExists: !!accountChecks[1],
        tokenMintOwner: accountChecks[1]?.owner.toBase58(),
        ammAccount: ammAccount.toBase58(),
        ammAccountExists: !!accountChecks[2],
        ammAccountOwner: accountChecks[2]?.owner.toBase58(),
        userTokenAccount: userTokenAccount.toBase58(),
        userTokenAccountExists: !!accountChecks[3],
        userTokenAccountOwner: accountChecks[3]?.owner.toBase58(),
        launchDataAccount: launchDataAccount.toBase58(),
        launchDataAccountExists: !!accountChecks[4],
        launchDataAccountOwner: accountChecks[4]?.owner.toBase58(),
        poolStateAccount: poolStateAccount.toBase58(),
        poolStateAccountExists: !!accountChecks[5],
        poolAuthorityAccount: poolAuthorityAccount.toBase58(),
        poolAuthorityAccountExists: !!accountChecks[6],
        poolTokenAccount: poolTokenAccount.toBase58(),
        poolTokenAccountExists: !!accountChecks[7],
        programId: PROGRAM_ID.toBase58(),
        instructionDataLength: instructionData.length,
        instructionDataHex: instructionData.toString('hex')
      });

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userKey, isSigner: true, isWritable: true },           // user (0)
          { pubkey: poolStateAccount, isSigner: false, isWritable: true },  // pool_state (1)
          { pubkey: poolAuthorityAccount, isSigner: false, isWritable: true }, // pool_authority (2)
          { pubkey: userSolAccount, isSigner: false, isWritable: true },    // user_token_in (3) - SOL
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },  // user_token_out (4) - tokens
          { pubkey: poolSolAccount, isSigner: false, isWritable: true },    // pool_token_in (5) - SOL
          { pubkey: poolTokenAccount, isSigner: false, isWritable: true },  // pool_token_out (6) - tokens
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program (7)
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      transaction.add(instruction);
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userKey;
      
      // Simulate transaction before sending
      console.log('🧪 Simulating transaction...');
      const simResult = await this.connection.simulateTransaction(transaction);
      if (simResult.value.err) {
        console.error('❌ Simulation failed:', simResult.value.err);
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
      }
      console.log('✅ Simulation successful');
      
      console.log('📤 Sending instant swap transaction...');
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('✅ Instant swap transaction sent:', signature);
      
      // Wait for confirmation with structured confirmation
      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
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
    signTransaction?: (transaction: Transaction) => Promise<Transaction>,
    dexProvider: 'cook' | 'raydium' = 'raydium'
  ): Promise<TradeResult> {
    try {
      console.log('🔄 Selling tokens via instant swap:', {
        tokenMint,
        userPublicKey,
        tokenAmount,
        dexProvider
      });

      if (!signTransaction) {
        throw new Error('signTransaction function not provided');
      }

      const userKey = new PublicKey(userPublicKey);
      const tokenMintKey = new PublicKey(tokenMint);
      
      // Check if the provided tokenMint is actually an SPL token mint
      console.log('🔍 Checking if tokenMint is a real SPL token mint (sell)...');
      const mintAccountInfo = await this.connection.getAccountInfo(tokenMintKey);
      const isRealTokenMint = mintAccountInfo?.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58();
      
      console.log('📊 Token mint analysis (sell):', {
        address: tokenMintKey.toBase58(),
        owner: mintAccountInfo?.owner.toBase58(),
        isSPLToken: isRealTokenMint,
        expectedOwner: TOKEN_PROGRAM_ID.toBase58()
      });
      
      // Calculate amounts (simplified: 1000 tokens = 1 SOL)
      const solAmount = tokenAmount / 1000;
      const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const minimumSolAmount = Math.floor(amountInLamports * 0.995); // 0.5% slippage tolerance
      
      // Derive the correct accounts for SwapRaydium
      const [launchDataAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('launch'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      const [ammAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      // Create transaction
      const transaction = new Transaction();
      
      // Only create ATA if we have a real token mint
      let userTokenAccount: PublicKey;
      if (isRealTokenMint) {
        userTokenAccount = await this.ensureTokenAccountExists(
          tokenMintKey,
          userKey,
          transaction
        );
      } else {
        // For non-SPL accounts, derive the ATA address but don't create it
        userTokenAccount = await getAssociatedTokenAddress(tokenMintKey, userKey);
        console.log('📝 Using derived ATA address without creation (sell):', userTokenAccount.toBase58());
      }
      
      // Create instruction data based on DEX provider
      let instructionData: Buffer;
      
      if (dexProvider === 'cook') {
        // Try using variant index approach instead of discriminator
        console.log('🍳 Using CookDEX SwapCookAMM instruction for sell (variant index)');
        
        // Use simple variant index + args approach
        const argsBuffer = Buffer.alloc(16); // u64 + u64 = 16 bytes
        argsBuffer.writeBigUInt64LE(BigInt(tokenAmount), 0); // Token amount
        argsBuffer.writeBigUInt64LE(BigInt(minimumSolAmount), 8); // Minimum SOL out
        
        instructionData = Buffer.concat([
          Buffer.from([10]), // SwapCookAMM variant index from LaunchInstruction enum
          argsBuffer
        ]);
      } else {
        // Use SwapRaydium instruction (variant 21)
        const argsBuffer = Buffer.alloc(16); // u64 + u64 = 16 bytes
        argsBuffer.writeBigUInt64LE(BigInt(tokenAmount), 0); // Token amount
        argsBuffer.writeBigUInt64LE(BigInt(minimumSolAmount), 8); // Minimum SOL out
        
        instructionData = Buffer.concat([
          Buffer.from([21]), // SwapRaydium variant index
          argsBuffer
        ]);
        console.log('⚡ Using Raydium SwapRaydium instruction for sell');
      }
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userKey, isSigner: true, isWritable: true },           // user (0)
          { pubkey: tokenMintKey, isSigner: false, isWritable: true },     // token_mint (1)
          { pubkey: ammAccount, isSigner: false, isWritable: true },       // amm_account (2)
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },  // user_token_account (3)
          { pubkey: userKey, isSigner: false, isWritable: true },          // user_sol_account (4) - same as user
          { pubkey: launchDataAccount, isSigner: false, isWritable: true }, // ledger_wallet (5) - using launch_data as ledger
          { pubkey: launchDataAccount, isSigner: false, isWritable: true }, // launch_data (6) - for trading gate
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      transaction.add(instruction);
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userKey;
      
      // Simulate transaction before sending
      console.log('🧪 Simulating transaction...');
      const simResult = await this.connection.simulateTransaction(transaction);
      if (simResult.value.err) {
        console.error('❌ Simulation failed:', simResult.value.err);
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
      }
      console.log('✅ Simulation successful');
      
      console.log('📤 Sending instant swap transaction...');
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('✅ Instant swap transaction sent:', signature);
      
      // Wait for confirmation with structured confirmation
      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
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
      
      // Derive the launch data account PDA
      const [launchDataAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('launch_data'), rafflePubkey.toBuffer()],
        PROGRAM_ID
      );
      
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
          { pubkey: launchDataAccount, isSigner: false, isWritable: true }, // launch_data
          { pubkey: userPubkey, isSigner: false, isWritable: true },         // user_sol_account (same as user for SOL)
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
      
      // Debug: Check if the launch data account exists and has valid data
      console.log('🔍 Checking launch data account before transaction...');
      const launchAccountInfo = await this.connection.getAccountInfo(launchDataAccount);
      if (!launchAccountInfo) {
        throw new Error('Raffle account not found');
      }
      console.log('📊 Launch data account info:', {
        exists: true,
        owner: launchAccountInfo.owner.toBase58(),
        dataLength: launchAccountInfo.data.length,
        executable: launchAccountInfo.executable,
        rentEpoch: launchAccountInfo.rentEpoch
      });
      
      // Check if the account is owned by our program
      console.log('🔍 Program ID comparison:', {
        accountOwner: launchAccountInfo.owner.toBase58(),
        expectedProgramId: PROGRAM_ID.toBase58(),
        areEqual: launchAccountInfo.owner.toBase58() === PROGRAM_ID.toBase58()
      });
      
      if (launchAccountInfo.owner.toBase58() !== PROGRAM_ID.toBase58()) {
        throw new Error(`Invalid raffle account: owned by ${launchAccountInfo.owner.toBase58()}, expected ${PROGRAM_ID.toBase58()}`);
      }
      
      // Get recent blockhash
      const { blockhash: recentBlockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = userPubkey;
      
      // Simulate transaction before sending
      console.log('🧪 Simulating buy tickets transaction...');
      const simResult = await this.connection.simulateTransaction(transaction);
      if (simResult.value.err) {
        console.error('❌ Simulation failed:', simResult.value.err);
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
      }
      console.log('✅ Simulation successful');
      
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
      
      // Wait for confirmation with structured confirmation
      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
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
      
      // Derive the actual token mint from the raffle account
      // For now, we'll use the raffle ID as the token mint (this needs to be verified)
      const tokenMint = rafflePubkey;
      
      // Get the user's Associated Token Account for this token mint
      const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPubkey);
      
      console.log('🎯 Claim tokens details:', {
        raffleId: raffleId,
        tokenMint: tokenMint.toBase58(),
        userTokenAccount: userTokenAccount.toBase58(),
        user: userPubkey.toBase58()
      });
      
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
      const { blockhash: recentBlockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = userPubkey;
      
      // Simulate transaction before sending
      console.log('🧪 Simulating claim tokens transaction...');
      const simResult = await this.connection.simulateTransaction(transaction);
      if (simResult.value.err) {
        console.error('❌ Simulation failed:', simResult.value.err);
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
      }
      console.log('✅ Simulation successful');
      
      console.log('📤 Sending claim tokens transaction...');
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('✅ Claim tokens transaction sent:', signature);
      
      // Wait for confirmation with structured confirmation
      await this.connection.confirmTransaction({
        signature,
        blockhash: recentBlockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
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
      
      // Derive the correct accounts for raffle ticket purchase
      const [launchDataAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('launch'), rafflePubkey.toBuffer()],
        PROGRAM_ID
      );
      
      const [ammAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), rafflePubkey.toBuffer()],
        PROGRAM_ID
      );
      
      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(
        rafflePubkey,
        userPubkey
      );
      
      // Create instruction data for BuyTickets (variant 2)
      const argsBuffer = Buffer.alloc(8); // u64 = 8 bytes
      argsBuffer.writeBigUInt64LE(BigInt(amountInLamports), 0);
      
      const instructionData = Buffer.concat([
        Buffer.from([2]), // BuyTickets variant index
        argsBuffer
      ]);
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },           // user
          { pubkey: launchDataAccount, isSigner: false, isWritable: true },    // launch_data
          { pubkey: ammAccount, isSigner: false, isWritable: true },            // amm_account
          { pubkey: userTokenAccount, isSigner: false, isWritable: true },     // user_token_account
          { pubkey: rafflePubkey, isSigner: false, isWritable: true },        // token_mint
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },    // token_program
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

  /**
   * Get the actual SPL token mint from a launch account
   * This method attempts to derive or fetch the real token mint from launch data
   */
  private async getActualTokenMintFromLaunch(launchAccount: PublicKey): Promise<PublicKey | null> {
    try {
      console.log('🔍 Fetching launch data for account:', launchAccount.toBase58());
      
      // Try the launch account itself first (it might contain the launch data)
      console.log('🔍 Checking launch account itself:', launchAccount.toBase58());
      
      let accountInfo = await this.connection.getAccountInfo(launchAccount);
      if (!accountInfo) {
        console.log('❌ Launch account not found');
        return null;
      }
      
      // If the launch account itself doesn't contain launch data, try deriving a PDA
      if (accountInfo.data.length === 0 || accountInfo.owner.toBase58() !== PROGRAM_ID.toBase58()) {
        console.log('🔍 Launch account is not owned by program, trying PDA derivation...');
        
        const [launchDataAccount] = PublicKey.findProgramAddressSync(
          [Buffer.from('launch'), launchAccount.toBuffer()],
          PROGRAM_ID
        );
        
        console.log('🔍 Derived launch data account:', launchDataAccount.toBase58());
        
        accountInfo = await this.connection.getAccountInfo(launchDataAccount);
        if (!accountInfo) {
          console.log('❌ Derived launch data account not found');
          return null;
        }
      }
      
      console.log('📊 Launch data account info:', {
        owner: accountInfo.owner.toBase58(),
        dataLength: accountInfo.data.length,
        executable: accountInfo.executable,
        rentEpoch: accountInfo.rentEpoch,
        firstBytes: Array.from(accountInfo.data.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });
      
      // Parse the launch data to extract token mint information
      // Based on the state structure, the token mint is stored in the 'keys' array
      // For instant launches: keys[0] = base_token_mint, keys[1] = quote_token_mint
      
      try {
        // Parse the Borsh-serialized launch data
        const launchData = this.parseLaunchData(accountInfo.data);
        
        if (launchData) {
          console.log('📊 Parsed launch data:', {
            accountType: launchData.accountType,
            launchMeta: launchData.launchMeta,
            pageName: launchData.pageName,
            listing: launchData.listing,
            keys: launchData.keys,
            is_tradable: launchData.is_tradable
          });
          
          if (launchData.keys && launchData.keys.length > 0) {
            console.log('🔍 Checking all keys for valid Solana PublicKeys:', launchData.keys);
            
            // Look through all keys to find a valid Solana PublicKey that's an SPL token mint
            for (let i = 0; i < launchData.keys.length; i++) {
              const keyAddress = launchData.keys[i];
              console.log(`🔍 Checking keys[${i}]:`, keyAddress);
              
              // Check if this looks like a valid Solana PublicKey (base58, 32-44 chars)
              if (this.isValidSolanaPublicKey(keyAddress)) {
                try {
                  const tokenMint = new PublicKey(keyAddress);
                  
                  // Verify this is actually an SPL token mint
                  const mintInfo = await this.connection.getAccountInfo(tokenMint);
                  if (mintInfo && mintInfo.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58()) {
                    console.log(`✅ Found valid SPL token mint in keys[${i}]:`, tokenMint.toBase58());
                    return tokenMint;
                  } else {
                    console.log(`❌ keys[${i}] is not an SPL token mint, owner:`, mintInfo?.owner.toBase58());
                  }
                } catch (error) {
                  console.log(`❌ keys[${i}] is not a valid PublicKey:`, error instanceof Error ? error.message : String(error));
                }
              } else {
                console.log(`❌ keys[${i}] doesn't look like a Solana PublicKey:`, keyAddress);
              }
            }
            
            console.log('❌ No valid SPL token mint found in keys array');
          } else {
            console.log('❌ No keys array found in launch data');
          }
          
          // Check if this is a tradable launch
          if (!launchData.is_tradable) {
            console.log('❌ Launch is not tradable (raffle-style launch)');
            console.log('💡 Raffle launches do not have SPL token mints until tokens are claimed');
            return null;
          }
          
          // Check launch type
          if (launchData.launchMeta === 0) {
            console.log('❌ This is a Raffle launch (launchMeta: 0) - no SPL token mint exists yet');
            console.log('💡 Raffle launches create SPL token mints only when tokens are claimed');
            return null;
          }
        } else {
          console.log('❌ Failed to parse launch data');
        }
        
      } catch (error) {
        console.error('❌ Error parsing launch data:', error);
      }
      
      console.log('❌ Could not find valid SPL token mint for launch account');
      return null;
      
    } catch (error) {
      console.error('❌ Error fetching token mint from launch:', error);
      return null;
    }
  }

  /**
   * Check if a string looks like a valid Solana PublicKey
   */
  private isValidSolanaPublicKey(address: string): boolean {
    // Solana PublicKeys are base58 encoded and typically 32-44 characters
    // They only contain characters: 1-9, A-H, J-N, P-Z, a-k, m-z (no 0, O, I, l)
    const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Pattern.test(address);
  }

  /**
   * Parse Borsh-serialized launch data
   * This is a simplified parser for the LaunchData structure
   */
  private parseLaunchData(data: Buffer): any {
    try {
      let offset = 0;
      
      // Read account_type (u8)
      const accountType = data.readUInt8(offset);
      offset += 1;
      
      // Read launch_meta (u8) - simplified, actual enum might be more complex
      const launchMeta = data.readUInt8(offset);
      offset += 1;
      
      // Read plugins Vec<u8>
      const pluginsLength = data.readUInt32LE(offset);
      offset += 4;
      const plugins = Array.from(data.slice(offset, offset + pluginsLength));
      offset += pluginsLength;
      
      // Read last_interaction (u64)
      const lastInteraction = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Read num_interactions (u16)
      const numInteractions = data.readUInt16LE(offset);
      offset += 2;
      
      // Read page_name String
      const pageNameLength = data.readUInt32LE(offset);
      offset += 4;
      const pageName = data.slice(offset, offset + pageNameLength).toString('utf8');
      offset += pageNameLength;
      
      // Read listing String
      const listingLength = data.readUInt32LE(offset);
      offset += 4;
      const listing = data.slice(offset, offset + listingLength).toString('utf8');
      offset += listingLength;
      
      // Skip other fields we don't need for now and jump to the end
      // This is a simplified parser - we'll look for the keys array near the end
      
      // Try to find the keys array by looking for patterns
      // The keys array is near the end of the structure
      const dataString = data.toString('utf8', offset);
      
      // Look for PublicKey patterns (base58 strings) - be more specific
      const pubkeyPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
      const matches = dataString.match(pubkeyPattern);
      
      // Filter matches to only include valid-looking Solana PublicKeys
      const validKeys = matches ? matches.filter(match => this.isValidSolanaPublicKey(match)) : [];
      
      if (validKeys.length >= 1) {
        return {
          accountType,
          launchMeta,
          pageName,
          listing,
          keys: validKeys.slice(0, 3), // Take first 3 valid keys
          is_tradable: launchMeta === 1 // FCFS/Instant launches are tradable
        };
      }
      
      return {
        accountType,
        launchMeta,
        pageName,
        listing,
        keys: [],
        is_tradable: launchMeta === 1
      };
      
    } catch (error) {
      console.error('Error parsing launch data:', error);
      return null;
    }
  }
}

// Export a default instance
export const tradingService = new TradingService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);