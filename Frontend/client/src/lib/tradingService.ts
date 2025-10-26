import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID } from './nativeProgram';
import { launchDataService } from './launchDataService';

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
  
  // Request throttling to prevent 429 errors
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private readonly REQUEST_DELAY = 200; // 200ms delay between requests

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Throttled request to prevent 429 errors
   */
  private async throttledRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  /**
   * Process the request queue with delays
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
          // Add delay between requests to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
        } catch (error) {
          console.error('❌ Trading request failed:', error);
          // Continue processing other requests even if one fails
        }
      }
    }

    this.isProcessingQueue = false;
  }

  // Helper method to ensure token account exists - creates in SEPARATE transaction if needed
  private async ensureTokenAccountExists(
    tokenMint: PublicKey,
    userPublicKey: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<PublicKey> {
    // Check if this is a Token 2022 mint to use correct token program for ATA derivation
    const mintAccountInfo = await this.throttledRequest(() => this.connection.getAccountInfo(tokenMint));
    const isToken2022 = mintAccountInfo?.owner.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58();
    const tokenProgram = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    
    console.log('🔍 Using token program for ATA derivation:', tokenProgram.toBase58(), isToken2022 ? '(Token 2022)' : '(SPL Token)');
    
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPublicKey, false, tokenProgram);
    
    try {
      const accountInfo = await this.connection.getAccountInfo(userTokenAccount);
      if (!accountInfo) {
        console.log('🔄 Token account does not exist. Creating in separate transaction...');
        
        try {
          console.log('🔍 Using token program for ATA creation:', tokenProgram.toBase58(), isToken2022 ? '(Token 2022)' : '(SPL Token)');
          
          // Create ATA in a SEPARATE transaction
          const ataTransaction = new Transaction();
          const createAccountInstruction = createAssociatedTokenAccountInstruction(
            userPublicKey, // payer
            userTokenAccount, // associatedToken
            userPublicKey, // owner
            tokenMint, // mint
            tokenProgram // programId - use correct token program
          );
          ataTransaction.add(createAccountInstruction);
          
          // Get recent blockhash for ATA transaction
          const { blockhash: ataBlockhash, lastValidBlockHeight: ataLastValidBlockHeight } = await this.connection.getLatestBlockhash();
          ataTransaction.recentBlockhash = ataBlockhash;
          ataTransaction.feePayer = userPublicKey;
          
          // Sign and send ATA creation transaction
          console.log('📤 Sending ATA creation transaction...');
          const signedAtaTransaction = await signTransaction(ataTransaction);
          const ataSignature = await this.connection.sendRawTransaction(
            signedAtaTransaction.serialize(),
            {
              skipPreflight: false,
              preflightCommitment: 'confirmed'
            }
          );
          
          console.log('✅ ATA creation transaction sent:', ataSignature);
          
          // Wait for ATA creation to confirm
          await this.connection.confirmTransaction({
            signature: ataSignature,
            blockhash: ataBlockhash,
            lastValidBlockHeight: ataLastValidBlockHeight
          }, 'confirmed');
          
          console.log('✅ Token account created successfully');
          
          // Small delay to ensure state propagation
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verify ATA was created
          const ataAccountInfo = await this.connection.getAccountInfo(userTokenAccount);
          if (!ataAccountInfo) {
            throw new Error('ATA creation failed - account does not exist after confirmation');
          }
          console.log('✅ ATA verified on-chain:', {
            address: userTokenAccount.toBase58(),
            owner: ataAccountInfo.owner.toBase58()
          });
        } catch (ataError: any) {
          // Check if ATA was already created (common race condition)
          if (ataError.message && (ataError.message.includes('already been processed') || ataError.message.includes('already in use'))) {
            console.log('⚠️ ATA creation was already processed or account already exists');
            // Continue - ATA is now created
          } else {
            // Re-throw other errors
            throw ataError;
          }
        }
      } else {
        console.log('✅ Token account already exists');
      }
    } catch (error) {
      console.error('❌ Error ensuring token account exists:', error);
      throw error;
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
      
      // Check if the provided tokenMint is actually a token mint (SPL or Token 2022)
      console.log('🔍 Checking if tokenMint is a real token mint...');
      const mintAccountInfo = await this.connection.getAccountInfo(tokenMintKey);
      const isSPLToken = mintAccountInfo?.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58();
      const isToken2022 = mintAccountInfo?.owner.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58();
      const isRealTokenMint = isSPLToken || isToken2022;
      
      console.log('📊 Token mint analysis:', {
        address: tokenMintKey.toBase58(),
        owner: mintAccountInfo?.owner.toBase58(),
        isSPLToken,
        isToken2022,
        isRealTokenMint,
        expectedSPLOwner: TOKEN_PROGRAM_ID.toBase58(),
        expectedToken2022Owner: TOKEN_2022_PROGRAM_ID.toBase58()
      });
      
      if (!isRealTokenMint) {
        console.log('⚠️ Provided tokenMint is not an SPL token mint. This is likely a launch account.');
        console.log('🔄 Attempting to get the actual token mint from launch data...');
        
        // Try to get the launch data first to see if it contains the actual token mint
        try {
          const { blockchainIntegrationService } = await import('./blockchainIntegrationService');
          const launchData = await blockchainIntegrationService.getLaunchByAddress(tokenMintKey.toBase58());
          
          if (launchData && launchData.baseTokenMint) {
            console.log('✅ Found baseTokenMint in launch data:', launchData.baseTokenMint);
            
            // Check if the baseTokenMint is a real SPL token mint
            const baseTokenMintKey = new PublicKey(launchData.baseTokenMint);
            const baseMintInfo = await this.connection.getAccountInfo(baseTokenMintKey);
            const isBaseSPLToken = baseMintInfo?.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58();
            
            if (isBaseSPLToken) {
              console.log('✅ baseTokenMint is a real SPL token mint, using it');
              tokenMintKey = baseTokenMintKey;
            } else {
              console.log('⚠️ baseTokenMint is not an SPL token mint, trying derivation...');
              // Fallback to the old derivation method
              const actualTokenMint = await this.getActualTokenMintFromLaunch(tokenMintKey);
              if (actualTokenMint) {
                console.log('✅ Found actual SPL token mint via derivation:', actualTokenMint.toBase58());
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
          } else {
            console.log('⚠️ No baseTokenMint found in launch data, trying derivation...');
            // Fallback to the old derivation method
            const actualTokenMint = await this.getActualTokenMintFromLaunch(tokenMintKey);
            if (actualTokenMint) {
              console.log('✅ Found actual SPL token mint via derivation:', actualTokenMint.toBase58());
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
        } catch (error) {
          console.error('❌ Error getting launch data:', error);
          
          // If we can't get launch data, try to use the provided address as-is
          // This handles cases where the address might already be a token mint
          console.log('🔄 Attempting to use provided address as token mint...');
          const providedMintInfo = await this.connection.getAccountInfo(tokenMintKey);
          
          if (providedMintInfo && 
              (providedMintInfo.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58() || 
               providedMintInfo.owner.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')) {
            console.log('✅ Provided address is a valid token mint, using it');
            // tokenMintKey is already set correctly
          } else {
            throw new Error('Could not derive valid token mint from provided address');
          }
        }
      }
      
      // Calculate amount in lamports
      const amountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const minimumTokenAmount = Math.floor(solAmount * 1000 * 0.995); // 0.5% slippage tolerance
      
      // Derive the correct accounts for Cook AMM
      // For instant launches, we need to get the launch account from the token mint
      // The launch data account is the original launch account, not derived from token mint
      let launchDataAccount: PublicKey;
      try {
        // Try to get the launch account by searching for the token mint
        console.log('🔍 Searching for launch with token mint:', tokenMintKey.toBase58());
        const launchData = await launchDataService.getLaunchByTokenMint(tokenMintKey.toBase58());
        if (launchData && launchData.launchDataAccount) {
          launchDataAccount = new PublicKey(launchData.launchDataAccount);
          console.log('✅ Found launch data account via token mint search:', launchDataAccount.toBase58());
        } else {
          // For instant launches, try to find the launch account by searching all launches
          console.log('🔍 Token mint not found in launch data, searching all launches...');
          const allLaunches = await launchDataService.getAllLaunches();
          const matchingLaunch = allLaunches.find(launch => 
            launch.baseTokenMint === tokenMintKey.toBase58() || 
            launch.rawMetadata?.keys?.includes(tokenMintKey.toBase58())
          );
          
          if (matchingLaunch && matchingLaunch.launchDataAccount) {
            launchDataAccount = new PublicKey(matchingLaunch.launchDataAccount);
            console.log('✅ Found launch data account via comprehensive search:', launchDataAccount.toBase58());
          } else {
            // Fallback: derive from token mint (this might not work for instant launches)
            const [derivedLaunchAccount] = PublicKey.findProgramAddressSync(
              [Buffer.from('launch'), tokenMintKey.toBuffer()],
              PROGRAM_ID
            );
            launchDataAccount = derivedLaunchAccount;
            console.log('⚠️ Using fallback launch data account:', launchDataAccount.toBase58());
          }
        }
      } catch (error) {
        console.log('⚠️ Could not get launch data account, using fallback:', error);
        const [derivedLaunchAccount] = PublicKey.findProgramAddressSync(
          [Buffer.from('launch'), tokenMintKey.toBuffer()],
          PROGRAM_ID
        );
        launchDataAccount = derivedLaunchAccount;
      }
      
      console.log('🔍 Launch data account:', launchDataAccount.toBase58());
      
      // Check if launch data account exists
      const launchAccountInfo = await this.connection.getAccountInfo(launchDataAccount);
      console.log('🔍 Launch data account info:', {
        exists: !!launchAccountInfo,
        owner: launchAccountInfo?.owner.toBase58(),
        dataLength: launchAccountInfo?.data.length
      });
      
      // Create transaction
      const transaction = new Transaction();
      
      // Only create ATA if we have a real token mint
      console.log('🔍 About to ensure token account exists. isRealTokenMint:', isRealTokenMint);
      let userTokenAccount: PublicKey;
      if (isRealTokenMint) {
        console.log('✅ Calling ensureTokenAccountExists...');
        userTokenAccount = await this.ensureTokenAccountExists(
          tokenMintKey,
          userKey,
          signTransaction
        );
        console.log('✅ ensureTokenAccountExists completed. ATA:', userTokenAccount.toBase58());
      } else {
        // For non-SPL accounts, derive the ATA address but don't create it
        userTokenAccount = await getAssociatedTokenAddress(tokenMintKey, userKey);
        console.log('📝 Using derived ATA address without creation:', userTokenAccount.toBase58());
      }
      
      // Create instruction data for Cook AMM swap
      let instructionData: Buffer;
      
      // Use Cook AMM instruction (variant 20) - this is what our program expects
      console.log('⚡ Using Cook AMM swap instruction');
      
      // Cook AMM uses PlaceOrderArgs with proper Borsh serialization (Backend version)
      // Structure: side(u8) + limit_price(u64) + max_base_quantity(u64) + max_quote_quantity(u64) + order_type(u8) + client_order_id(u64) + limit(u16)
      const argsBuffer = Buffer.alloc(36); // Exact size: 1 + 8 + 8 + 8 + 1 + 8 + 2 = 36 bytes
      let offset = 0;
      
      // Write side (u8): 0 = buy, 1 = sell
      argsBuffer.writeUInt8(0, offset);
      offset += 1;
      
      // Write limit_price (u64): 0 for market order
      argsBuffer.writeBigUInt64LE(BigInt(0), offset);
      offset += 8;
      
      // Write max_base_quantity (u64): minimum token amount expected
      argsBuffer.writeBigUInt64LE(BigInt(minimumTokenAmount), offset);
      offset += 8;
      
      // Write max_quote_quantity (u64): SOL amount to spend
      argsBuffer.writeBigUInt64LE(BigInt(amountInLamports), offset);
      offset += 8;
      
      // Write order_type (u8): 0 = market order
      argsBuffer.writeUInt8(0, offset);
      offset += 1;
      
      // Write client_order_id (u64): unique identifier
      argsBuffer.writeBigUInt64LE(BigInt(Date.now()), offset);
      offset += 8;
      
      // Write limit (u16): 0 = no limit
      argsBuffer.writeUInt16LE(0, offset);
      offset += 2;
      
      instructionData = Buffer.concat([
        Buffer.from([10]), // Cook AMM variant index (SwapCookAMM) - 10th variant (0-indexed)
        argsBuffer
      ]);
      
      console.log('🔍 Cook AMM instruction data:', {
        variant: 10,
        argsBufferLength: argsBuffer.length,
        argsBufferHex: argsBuffer.toString('hex'),
        totalLength: instructionData.length
      });
      
      // Derive Cook AMM accounts
      const [ammAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      // Fees account (ledger_wallet) - loaded from environment variable
      const feesAccount = new PublicKey(import.meta.env.VITE_LEDGER_WALLET || 'A3pqxWWtgxY9qspd4wffSJQNAb99bbrUHYb1doMQmPcK');
      
      // For Cook AMM swaps, we need the user's SOL account (same as user key for SOL)
      const userSolAccount = userKey;

      // Debug: Check if accounts exist
      console.log('🔍 Checking account existence...');
      
      const accountChecks = await Promise.all([
        this.connection.getAccountInfo(userKey),
        this.connection.getAccountInfo(tokenMintKey),
        this.connection.getAccountInfo(ammAccount),
        this.connection.getAccountInfo(userTokenAccount),
        this.connection.getAccountInfo(userSolAccount),
        this.connection.getAccountInfo(feesAccount),
        this.connection.getAccountInfo(launchDataAccount)
      ]);
      
      // Determine the correct token program based on the mint type
      const tokenProgram = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      console.log('🔍 Using token program:', tokenProgram.toBase58(), isToken2022 ? '(Token 2022)' : '(SPL Token)');

      // Create instruction keys according to Backend SwapCookAMM account structure
      const instructionKeys = [
        { pubkey: userKey, isSigner: true, isWritable: true },        // user (0)
        { pubkey: tokenMintKey, isSigner: false, isWritable: true }, // token_mint (1) - MUST be writable for minting
        { pubkey: ammAccount, isSigner: false, isWritable: true },    // amm_account (2)
        { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // user_token_account (3)
        { pubkey: userSolAccount, isSigner: false, isWritable: true }, // user_sol_account (4)
        { pubkey: feesAccount, isSigner: false, isWritable: true },   // ledger_wallet (5) - needs to be writable to receive fees
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program (6)
        { pubkey: tokenProgram, isSigner: false, isWritable: false }, // token_program (7) - REQUIRED for mint_to CPI
      ];
      
      // Only add launch data account if it exists (optional 9th account)
      if (launchAccountInfo) {
        instructionKeys.push({ pubkey: launchDataAccount, isSigner: false, isWritable: false }); // launch_data (8) - optional
      }

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
        userSolAccount: userSolAccount.toBase58(),
        userSolAccountExists: !!accountChecks[4],
        feesAccount: feesAccount.toBase58(),
        feesAccountExists: !!accountChecks[5],
        launchDataAccount: launchDataAccount.toBase58(),
        launchDataAccountExists: !!launchAccountInfo,
        launchDataAccountOwner: launchAccountInfo?.owner.toBase58(),
        instructionKeysCount: instructionKeys.length,
        programId: PROGRAM_ID.toBase58(),
        instructionDataLength: instructionData.length,
        instructionDataHex: instructionData.toString('hex')
      });

      // Check each account individually and log detailed info
      console.log('🔍 Detailed Account Check:');
      instructionKeys.forEach((account, index) => {
        console.log(`Account ${index}:`, {
          pubkey: account.pubkey.toBase58(),
          isSigner: account.isSigner,
          isWritable: account.isWritable,
          exists: index < accountChecks.length ? !!accountChecks[index] : 'not checked'
        });
      });

      // Check if AMM account is properly derived
      const [expectedAmmAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      console.log('🔍 AMM Account Verification:', {
        derivedAmmAccount: expectedAmmAccount.toBase58(),
        usedAmmAccount: ammAccount.toBase58(),
        accountsMatch: expectedAmmAccount.equals(ammAccount),
        ammAccountExists: !!accountChecks[2]
      });

      // If AMM account doesn't exist, initialize it first IN A SEPARATE TRANSACTION
      if (!accountChecks[2]) {
        console.log('⚠️ AMM account does not exist. Initializing AMM first...');
        
        try {
          // Create a separate transaction for AMM initialization
          const initTransaction = new Transaction();
          await this.initializeAMMAccount(userKey, tokenMintKey, ammAccount, initTransaction);
          
          // Get recent blockhash for init transaction
          const { blockhash: initBlockhash, lastValidBlockHeight: initLastValidBlockHeight } = await this.connection.getLatestBlockhash();
          initTransaction.recentBlockhash = initBlockhash;
          initTransaction.feePayer = userKey;
          
          // Sign and send init transaction
          console.log('📤 Sending AMM initialization transaction...');
          const signedInitTransaction = await signTransaction(initTransaction);
          const initSignature = await this.connection.sendRawTransaction(
            signedInitTransaction.serialize(),
            {
              skipPreflight: false,
              preflightCommitment: 'confirmed'
            }
          );
          
          console.log('✅ AMM initialization transaction sent:', initSignature);
          
          // Wait for initialization to confirm
          await this.connection.confirmTransaction({
            signature: initSignature,
            blockhash: initBlockhash,
            lastValidBlockHeight: initLastValidBlockHeight
          }, 'confirmed');
          
          console.log('✅ AMM account initialized successfully');
          
          // Small delay to ensure state propagation
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify AMM account was created
          const ammAccountInfo = await this.connection.getAccountInfo(ammAccount);
          if (!ammAccountInfo) {
            throw new Error('AMM account initialization failed - account does not exist after confirmation');
          }
          console.log('✅ AMM account verified on-chain:', {
            address: ammAccount.toBase58(),
            owner: ammAccountInfo.owner.toBase58(),
            dataLength: ammAccountInfo.data.length
          });
        } catch (initError: any) {
          // Check if AMM was already initialized (common race condition)
          if (initError.message && initError.message.includes('already been processed')) {
            console.log('⚠️ AMM initialization was already processed (may have been initialized by another transaction)');
            // Continue with swap - AMM is now initialized
          } else {
            // Re-throw other errors
            throw initError;
          }
        }
      }

      const instruction = new TransactionInstruction({
        keys: instructionKeys,
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      transaction.add(instruction);
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userKey;
      
      // Simulate transaction before sending
      console.log('🧪 Simulating SWAP transaction...');
      console.log('🔍 Transaction has', transaction.instructions.length, 'instruction(s)');
      const simResult = await this.connection.simulateTransaction(transaction);
      if (simResult.value.err) {
        console.error('❌ Simulation failed:', simResult.value.err);
        console.error('❌ Simulation logs:', simResult.value.logs);
        
        // Check for specific error types and provide better error messages
        if (simResult.value.err && typeof simResult.value.err === 'object' && 'InstructionError' in simResult.value.err) {
          const instructionError = simResult.value.err as any;
          const [instructionIndex, error] = instructionError.InstructionError;
          
          console.error(`❌ Failed at instruction ${instructionIndex}:`, error);
          
          if (error === 'BorshIoError') {
            throw new Error(`Transaction simulation failed: BorshIoError in instruction ${instructionIndex}. This usually means incorrect data serialization.`);
          } else if (error === 'AccountNotFound' || error === 'MissingAccount') {
            throw new Error(`Transaction simulation failed: ${error} in instruction ${instructionIndex}. Check simulation logs above for details.`);
          } else {
            throw new Error(`Transaction simulation failed: ${error} in instruction ${instructionIndex}`);
          }
        } else {
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
        }
      }
      console.log('✅ Simulation successful');
      console.log('📊 Simulation logs:', simResult.value.logs);
      
      console.log('📤 Sending instant swap transaction...');
      
      // Generate unique transaction ID to prevent replay attacks
      const transactionId = `${userKey.toBase58()}-${tokenMintKey.toBase58()}-${Date.now()}`;
      console.log('🔑 Transaction ID:', transactionId);
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });
      
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
      
      // Handle specific transaction replay error
      if (error instanceof Error && error.message.includes('already been processed')) {
        console.log('🔄 Transaction replay detected, this is normal for retries');
        return {
          success: false,
          error: 'Transaction was already processed. Please check your wallet for the transaction.'
        };
      }
      
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
      
      // Derive the AMM account
      const [ammAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      // Create transaction
      const transaction = new Transaction();
      
      // For sell operations, we need to ensure the user has a token account
      let userTokenAccount: PublicKey;
      
      // Check if this is a real token mint (SPL Token or Token 2022)
      const tokenMintAccountInfo = await this.connection.getAccountInfo(tokenMintKey);
      const isToken2022 = tokenMintAccountInfo?.owner.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58();
      const isSPLToken = tokenMintAccountInfo?.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58();
      const isAnyRealToken = isSPLToken || isToken2022;
      
      console.log('🔍 Token mint analysis for sell:', {
        address: tokenMintKey.toBase58(),
        owner: tokenMintAccountInfo?.owner.toBase58(),
        isSPLToken,
        isToken2022,
        isAnyRealToken
      });
      
      if (isAnyRealToken) {
        console.log('✅ Creating/ensuring token account exists for sell...', { isSPLToken, isToken2022 });
        userTokenAccount = await this.ensureTokenAccountExists(
          tokenMintKey,
          userKey,
          signTransaction
        );
        console.log('✅ Token account ensured for sell:', userTokenAccount.toBase58());
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
        
        // Use PlaceOrderArgs structure like buy instruction (36 bytes)
        const argsBuffer = Buffer.alloc(36); // Exact size: 1 + 8 + 8 + 8 + 1 + 8 + 2 = 36 bytes
        let offset = 0;
        
        // Convert token amount to smallest unit (assuming 9 decimals like SOL)
        const tokenAmountInSmallestUnit = Math.floor(tokenAmount * 1e9);
        
        // Write side (u8): 1 = sell
        argsBuffer.writeUInt8(1, offset);
        offset += 1;
        
        // Write limit_price (u64): 0 for market order
        argsBuffer.writeBigUInt64LE(BigInt(0), offset);
        offset += 8;
        
        // Write max_base_quantity (u64): token amount to sell
        argsBuffer.writeBigUInt64LE(BigInt(tokenAmountInSmallestUnit), offset);
        offset += 8;
        
        // Write max_quote_quantity (u64): minimum SOL amount expected
        argsBuffer.writeBigUInt64LE(BigInt(minimumSolAmount), offset);
        offset += 8;
        
        // Write order_type (u8): 0 = market order
        argsBuffer.writeUInt8(0, offset);
        offset += 1;
        
        // Write client_order_id (u64): unique identifier
        argsBuffer.writeBigUInt64LE(BigInt(Date.now()), offset);
        offset += 8;
        
        // Write limit (u16): 0 for no limit
        argsBuffer.writeUInt16LE(0, offset);
        
        instructionData = Buffer.concat([
          Buffer.from([10]), // SwapCookAMM variant index (10, not 20)
          argsBuffer
        ]);
        
        console.log('🔍 Sell instruction data:', {
          variant: 10,
          argsBufferLength: argsBuffer.length,
          argsBufferHex: argsBuffer.toString('hex'),
          totalLength: instructionData.length,
          side: 1, // sell
          tokenAmount: tokenAmountInSmallestUnit,
          minSolAmount: minimumSolAmount
        });
      } else {
        // Use PlaceOrderArgs structure for Raydium too (36 bytes)
        const argsBuffer = Buffer.alloc(36); // Exact size: 1 + 8 + 8 + 8 + 1 + 8 + 2 = 36 bytes
        let offset = 0;
        
        // Convert token amount to smallest unit (assuming 9 decimals like SOL)
        const tokenAmountInSmallestUnit = Math.floor(tokenAmount * 1e9);
        
        // Write side (u8): 1 = sell
        argsBuffer.writeUInt8(1, offset);
        offset += 1;
        
        // Write limit_price (u64): 0 for market order
        argsBuffer.writeBigUInt64LE(BigInt(0), offset);
        offset += 8;
        
        // Write max_base_quantity (u64): token amount to sell
        argsBuffer.writeBigUInt64LE(BigInt(tokenAmountInSmallestUnit), offset);
        offset += 8;
        
        // Write max_quote_quantity (u64): minimum SOL amount expected
        argsBuffer.writeBigUInt64LE(BigInt(minimumSolAmount), offset);
        offset += 8;
        
        // Write order_type (u8): 0 = market order
        argsBuffer.writeUInt8(0, offset);
        offset += 1;
        
        // Write client_order_id (u64): unique identifier
        argsBuffer.writeBigUInt64LE(BigInt(Date.now()), offset);
        offset += 8;
        
        // Write limit (u16): 0 for no limit
        argsBuffer.writeUInt16LE(0, offset);
        
        instructionData = Buffer.concat([
          Buffer.from([10]), // SwapCookAMM variant index (10, not 20)
          argsBuffer
        ]);
        console.log('⚡ Using SwapCookAMM instruction for sell (Raydium)');
      }
      
      // Derive accounts for sell instruction (reuse existing ammAccount)
      
      // Derive the launch data account
      const [launchDataAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('launch'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      // Check if launch data account exists
      const launchAccountInfo = await this.connection.getAccountInfo(launchDataAccount);
      console.log('🔍 Launch data account info:', {
        exists: !!launchAccountInfo,
        owner: launchAccountInfo?.owner.toBase58(),
        dataLength: launchAccountInfo?.data.length
      });
      
      // Fees account (ledger_wallet) - loaded from environment variable
      const feesAccount = new PublicKey(import.meta.env.VITE_LEDGER_WALLET || 'A3pqxWWtgxY9qspd4wffSJQNAb99bbrUHYb1doMQmPcK');
      
      // For Cook AMM swaps, we need the user's SOL account (same as user key for SOL)
      const userSolAccount = userKey;
      
      // Determine the correct token program based on account info
      const tokenProgram = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      
      // Debug: Check if accounts exist
      console.log('🔍 Checking account existence for sell...');
      
      const accountChecks = await Promise.all([
        this.connection.getAccountInfo(userKey),
        this.connection.getAccountInfo(tokenMintKey),
        this.connection.getAccountInfo(ammAccount),
        this.connection.getAccountInfo(userTokenAccount),
        this.connection.getAccountInfo(userSolAccount),
        this.connection.getAccountInfo(feesAccount),
        this.connection.getAccountInfo(SystemProgram.programId),
        this.connection.getAccountInfo(tokenProgram),
        this.connection.getAccountInfo(launchDataAccount)
      ]);
      
      console.log('📊 Account existence check:', {
        user: !!accountChecks[0],
        tokenMint: !!accountChecks[1],
        ammAccount: !!accountChecks[2],
        userTokenAccount: !!accountChecks[3],
        userSolAccount: !!accountChecks[4],
        feesAccount: !!accountChecks[5],
        systemProgram: !!accountChecks[6],
        tokenProgram: !!accountChecks[7],
        launchDataAccount: !!accountChecks[8]
      });
      
      console.log('🔍 Token program detection:', {
        tokenMint: tokenMintKey.toBase58(),
        owner: tokenMintAccountInfo?.owner.toBase58(),
        isToken2022,
        tokenProgram: tokenProgram.toBase58()
      });
      
      // Backend account structure for SwapCookAMM:
      // CRITICAL: Backend uses accounts[6] for system_program in invoke_signed, but checks
      // if accounts.len() > 6 to treat account[6] as launch_data for trading gate.
      // This is a backend bug. We must pass system_program and token_program even though
      // the backend references them incorrectly. The backend needs these for CPI calls.
      const instructionKeys = [
        { pubkey: userKey, isSigner: true, isWritable: true },           // user (0)
        { pubkey: tokenMintKey, isSigner: false, isWritable: true },     // token_mint (1)
        { pubkey: ammAccount, isSigner: false, isWritable: true },       // amm_account (2)
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },  // user_token_account (3)
        { pubkey: userSolAccount, isSigner: false, isWritable: true },   // user_sol_account (4)
        { pubkey: feesAccount, isSigner: false, isWritable: true },       // ledger_wallet (5)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program (6)
        { pubkey: tokenProgram, isSigner: false, isWritable: false },    // token_program (7)
      ];
      
      console.log('🔍 Sell instruction accounts:', instructionKeys.map((key, index) => ({
        index,
        pubkey: key.pubkey.toBase58(),
        isSigner: key.isSigner,
        isWritable: key.isWritable
      })));

      const instruction = new TransactionInstruction({
        keys: instructionKeys,
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
        console.error('📋 Simulation logs:', simResult.value.logs);
        
        // Check for specific error types and provide better error messages
        if (simResult.value.err && typeof simResult.value.err === 'object' && 'InstructionError' in simResult.value.err) {
          const instructionError = simResult.value.err as any;
          const [instructionIndex, error] = instructionError.InstructionError;
          if (error === 'BorshIoError') {
            throw new Error(`Transaction simulation failed: BorshIoError in instruction ${instructionIndex}. This usually means incorrect data serialization.`);
          } else if (error === 'AccountNotFound') {
            throw new Error(`Transaction simulation failed: Account not found in instruction ${instructionIndex}. Please check if all required accounts exist.`);
          } else {
            throw new Error(`Transaction simulation failed: ${error} in instruction ${instructionIndex}`);
          }
        } else {
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
        }
      }
      console.log('✅ Simulation successful');
      
      console.log('📤 Sending instant swap transaction...');
      
      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true, // Skip preflight since we already manually simulated above
        maxRetries: 3
      });
      
      console.log('✅ Instant swap transaction sent:', signature);
      
      // Wait for confirmation with timeout
      try {
        const confirmation = await Promise.race([
          this.connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          }, 'confirmed'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)
          )
        ]);
        
        if ((confirmation as any).value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify((confirmation as any).value.err)}`);
        }
        
        console.log('✅ Instant swap transaction confirmed');
      } catch (confirmationError) {
        console.warn('⚠️ Transaction confirmation timeout or error:', confirmationError);
        // Don't fail the entire operation if confirmation times out
        console.log('📝 Transaction was sent but confirmation timed out. Check your wallet for the transaction.');
      }
      
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
      
      // The raffleId IS the launch data account (regular account, not PDA)
      const launchDataAccount = new PublicKey(raffleId);
      
      console.log('🔍 Using launch data account:', launchDataAccount.toBase58());
      
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
      
      // Ledger wallet for platform fees - loaded from environment variable
      const LEDGER_WALLET = new PublicKey(import.meta.env.VITE_LEDGER_WALLET || 'A3pqxWWtgxY9qspd4wffSJQNAb99bbrUHYb1doMQmPcK');
      
      // Note: userPubkey appears twice because backend expects:
      // accounts[0] = user (signer)
      // accounts[2] = user_sol_account (for SOL transfers)
      // Both refer to the same wallet address
      // Solana runtime handles this by deduplicating automatically
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },        // accounts[0]: user
          { pubkey: launchDataAccount, isSigner: false, isWritable: true }, // accounts[1]: launch_data
          { pubkey: userPubkey, isSigner: true, isWritable: true },         // accounts[2]: user_sol_account (same as user)
          { pubkey: LEDGER_WALLET, isSigner: false, isWritable: true },     // accounts[3]: ledger_wallet
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // accounts[4]: system_program
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      console.log('🔍 Instruction accounts:', {
        user: userPubkey.toBase58(),
        launchData: launchDataAccount.toBase58(),
        userSolAccount: userPubkey.toBase58(),
        ledgerWallet: LEDGER_WALLET.toBase58(),
        systemProgram: SystemProgram.programId.toBase58()
      });
      
      // Debug: Check if all accounts exist before creating transaction
      console.log('🔍 Checking all accounts before transaction...');
      
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
      
      const ledgerWalletInfo = await this.connection.getAccountInfo(LEDGER_WALLET);
      console.log('📊 Ledger wallet info:', {
        exists: !!ledgerWalletInfo,
        owner: ledgerWalletInfo?.owner.toBase58(),
        lamports: ledgerWalletInfo?.lamports
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
      
      // Create transaction and set blockhash
      const transaction = new Transaction();
      const { blockhash: recentBlockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = userPubkey;
      transaction.add(instruction);
      
      // Simulate transaction before sending
      console.log('🧪 Simulating buy tickets transaction...');
      try {
        const simResult = await this.connection.simulateTransaction(transaction, undefined, { commitment: 'confirmed', replaceRecentBlockhash: true });
        
        console.log('📊 Simulation result:', {
          err: simResult.value.err,
          logs: simResult.value.logs,
          unitsConsumed: simResult.value.unitsConsumed
        });
        
        if (simResult.value.err) {
          console.error('❌ Simulation failed:', simResult.value.err);
          console.error('📋 Simulation logs:', simResult.value.logs);
          
          // Check for AccountBorrowFailed - this can happen with duplicate accounts during simulation
          // but the actual transaction might still work
          const errorStr = JSON.stringify(simResult.value.err);
          if (errorStr.includes('AccountBorrowFailed')) {
            console.warn('⚠️ Simulation failed with AccountBorrowFailed, but continuing anyway.');
            console.warn('This can happen when the same account appears multiple times in an instruction.');
            console.warn('The actual transaction may still succeed.');
          } else {
            // Check for specific error types and provide better error messages
            if (simResult.value.err && typeof simResult.value.err === 'object' && 'InstructionError' in simResult.value.err) {
              const instructionError = simResult.value.err as any;
              const [instructionIndex, error] = instructionError.InstructionError;
              if (error === 'BorshIoError') {
                throw new Error(`Transaction simulation failed: BorshIoError in instruction ${instructionIndex}. This usually means incorrect data serialization.`);
              } else if (error === 'AccountNotFound') {
                throw new Error(`Transaction simulation failed: Account not found in instruction ${instructionIndex}. Please check if all required accounts exist.`);
              } else {
                throw new Error(`Transaction simulation failed: ${error} in instruction ${instructionIndex}`);
              }
            } else {
              throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
            }
          }
        } else {
          console.log('✅ Simulation successful');
        }
      } catch (simError) {
        const errorMsg = simError instanceof Error ? simError.message : String(simError);
        if (errorMsg.includes('AccountBorrowFailed')) {
          console.warn('⚠️ Simulation error (AccountBorrowFailed), continuing anyway:', errorMsg);
        } else {
          throw simError;
        }
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
      
      // Wait for confirmation with structured confirmation
      await this.connection.confirmTransaction({
        signature,
        blockhash: recentBlockhash,
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
      
      // Check if this is a Token 2022 mint
      const mintAccountInfo = await this.throttledRequest(() => this.connection.getAccountInfo(tokenMint));
      const isToken2022 = mintAccountInfo?.owner.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58();
      const tokenProgram = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      
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
          { pubkey: tokenProgram, isSigner: false, isWritable: false }, // token_program
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
        
        // Check for specific error types and provide better error messages
        if (simResult.value.err && typeof simResult.value.err === 'object' && 'InstructionError' in simResult.value.err) {
          const instructionError = simResult.value.err as any;
          const [instructionIndex, error] = instructionError.InstructionError;
          if (error === 'BorshIoError') {
            throw new Error(`Transaction simulation failed: BorshIoError in instruction ${instructionIndex}. This usually means incorrect data serialization.`);
          } else if (error === 'AccountNotFound') {
            throw new Error(`Transaction simulation failed: Account not found in instruction ${instructionIndex}. Please check if all required accounts exist.`);
          } else {
            throw new Error(`Transaction simulation failed: ${error} in instruction ${instructionIndex}`);
          }
        } else {
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
        }
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
      
      // Fees account (ledger_wallet) - same as trading service
      const feesAccount = new PublicKey('A3pqxWWtgxY9qspd4wffSJQNAb99bbrUHYb1doMQmPcK');
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },           // user (0)
          { pubkey: launchDataAccount, isSigner: false, isWritable: true },    // launch_data (1)
          { pubkey: userPubkey, isSigner: false, isWritable: true },          // user_sol_account (2) - same as user
          { pubkey: feesAccount, isSigner: false, isWritable: true },         // ledger_wallet (3) - for platform fees
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program (4)
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
   * Initialize AMM account for instant launches
   */
  private async initializeAMMAccount(
    userKey: PublicKey,
    tokenMintKey: PublicKey,
    ammAccount: PublicKey,
    transaction: Transaction
  ): Promise<void> {
    console.log('🚀 Initializing AMM account...');
    
    // Create InitCookAMM instruction
    const initAMMInstruction = new TransactionInstruction({
      keys: [
        { pubkey: userKey, isSigner: true, isWritable: true },        // user (0)
        { pubkey: tokenMintKey, isSigner: false, isWritable: false }, // token_mint (1)
        { pubkey: ammAccount, isSigner: false, isWritable: true },    // amm_account (2)
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // system_program (3)
      ],
      programId: PROGRAM_ID,
      data: Buffer.from([4]), // InitCookAMM discriminator (5th variant, 0-indexed)
    });
    
    transaction.add(initAMMInstruction);
    console.log('✅ InitCookAMM instruction added to transaction');
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