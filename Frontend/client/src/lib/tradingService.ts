import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, ASSOCIATED_TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
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

  /**
   * Create amm_base token account using helper instruction
   * This fixes launches where amm_base wasn't created during launch
   */
  async createAmmBase(
    userPublicKey: PublicKey,
    ammAccount: PublicKey,
    tokenMint: PublicKey,
    signTransaction: (tx: Transaction) => Promise<Transaction>
  ): Promise<{
    success: boolean;
    signature?: string;
    ammBaseAddress?: string;
    error?: string;
  }> {
    try {
      console.log('🔧 Creating amm_base token account...');
      console.log('  User:', userPublicKey.toBase58());
      console.log('  AMM Account:', ammAccount.toBase58());
      console.log('  Token Mint:', tokenMint.toBase58());
      
      const { Keypair, Transaction, SystemProgram } = await import('@solana/web3.js');
      const { TOKEN_2022_PROGRAM_ID } = await import('@solana/spl-token');
      const { LetsCookProgram } = await import('./nativeProgram');
      
      // Generate amm_base keypair (same as during launch)
      const ammBaseKeypair = Keypair.generate();
      const ammBaseAddress = ammBaseKeypair.publicKey.toBase58();
      console.log('✅ Generated amm_base keypair:', ammBaseAddress);
      
      // Build instruction
      const instruction = LetsCookProgram.createAmmBaseInstruction({
        user: userPublicKey,
        ammBase: ammBaseKeypair.publicKey,
        amm: ammAccount,
        baseTokenMint: tokenMint,
        baseTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });
      
      // Create transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPublicKey;
      
      // Sign with keypair first, then wallet
      transaction.sign(ammBaseKeypair);
      const signedTx = await signTransaction(transaction);
      
      console.log('📤 Sending CreateAmmBase transaction...');
      const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      console.log('⏳ Confirming transaction...');
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      console.log('✅ amm_base created successfully!');
      console.log('  Address:', ammBaseAddress);
      console.log('  Signature:', signature);
      
      // Store the address in launch metadata for future use
      try {
        const { LaunchMetadataService } = await import('./launchMetadataService');
        await LaunchMetadataService.storeMetadata({
          launch_id: '', // Will be updated if we have launch_id
          token_mint: tokenMint.toBase58(),
          amm_base_token_account: ammBaseAddress,
        });
        console.log('✅ amm_base address stored in metadata');
      } catch (metadataError) {
        console.warn('⚠️ Could not store amm_base in metadata (non-critical):', metadataError);
      }
      
      return {
        success: true,
        signature,
        ammBaseAddress,
      };
    } catch (error) {
      console.error('❌ Error creating amm_base:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if amm_base token account exists on-chain
   * This is a diagnostic helper function
   */
  async checkAmmBaseOnChain(
    ammAccount: PublicKey,
    tokenMint: PublicKey
  ): Promise<{
    exists: boolean;
    address?: string;
    accountInfo?: any;
    error?: string;
  }> {
    try {
      console.log('🔍 Checking amm_base on-chain...');
      console.log('  AMM Account:', ammAccount.toBase58());
      console.log('  Token Mint:', tokenMint.toBase58());
      
      // Method 1: Query token accounts owned by AMM
      const response = await this.connection.getParsedTokenAccountsByOwner(
        ammAccount,
        { mint: tokenMint },
        'confirmed'
      );
      
      if (response.value && response.value.length > 0) {
        const accountInfo = response.value[0];
        const address = accountInfo.pubkey.toBase58();
        
        // Get full account info
        const fullInfo = await this.connection.getAccountInfo(accountInfo.pubkey);
        
        return {
          exists: true,
          address,
          accountInfo: {
            address,
            owner: fullInfo?.owner.toBase58(),
            lamports: fullInfo?.lamports,
            dataLength: fullInfo?.data.length,
            executable: fullInfo?.executable,
            rentEpoch: fullInfo?.rentEpoch,
            parsed: accountInfo.account?.data
          }
        };
      }
      
      // Method 2: Try querying all token accounts for AMM
      const allAccountsResponse = await this.connection.getParsedTokenAccountsByOwner(
        ammAccount,
        { programId: TOKEN_2022_PROGRAM_ID },
        'confirmed'
      );
      
      if (allAccountsResponse.value && allAccountsResponse.value.length > 0) {
        for (const acc of allAccountsResponse.value) {
          if (acc.account && acc.account.data && typeof acc.account.data === 'object' && 'parsed' in acc.account.data) {
            const parsed = acc.account.data.parsed as any;
            if (parsed.info && parsed.info.mint === tokenMint.toBase58()) {
              return {
                exists: true,
                address: acc.pubkey.toBase58(),
                accountInfo: {
                  address: acc.pubkey.toBase58(),
                  parsed: parsed
                }
              };
            }
          }
        }
      }
      
      return {
        exists: false,
        error: 'No token account found for AMM account with this token mint'
      };
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

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
   * Get swap quote for trading using actual AMM pool reserves (constant product formula)
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

      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const isSOLToToken = inputMint.equals(WSOL_MINT);
      const tokenMint = isSOLToToken ? outputMint : inputMint;

      // Get actual token decimals from mint account
      const { getMint, TOKEN_2022_PROGRAM_ID } = await import('@solana/spl-token');
      let tokenDecimals = 9; // Default fallback
      try {
        const mintInfo = await getMint(this.connection, tokenMint, 'confirmed', TOKEN_2022_PROGRAM_ID).catch(() => 
          getMint(this.connection, tokenMint, 'confirmed')
        );
        tokenDecimals = mintInfo.decimals;
        console.log('✅ Token decimals:', tokenDecimals);
      } catch (error) {
        console.warn('⚠️ Could not fetch token decimals, using default 9:', error);
      }

      // Try Raydium first if specified
      if (dexProvider === 'raydium') {
        const { raydiumService } = await import('./raydiumService');
        const poolAddress = await raydiumService.findPool(tokenMint, WSOL_MINT);
        
        if (poolAddress) {
          const amountIn = BigInt(Math.floor(amount * 1e9)); // Convert SOL to lamports
          const quote = await raydiumService.getSwapQuote(
            poolAddress,
            inputMint,
            outputMint,
            amountIn,
            50 // 0.5% slippage
          );
          
          if (quote) {
            // Convert output amount using correct decimals
            const outputAmount = isSOLToToken
              ? Number(quote.outputAmount) / Math.pow(10, tokenDecimals) // Token output
              : Number(quote.outputAmount) / 1e9; // SOL output
            
            const inputAmount = Number(quote.inputAmount) / 1e9; // Always SOL input in lamports
            const price = isSOLToToken 
              ? inputAmount / outputAmount // SOL per token
              : outputAmount / inputAmount; // SOL per token (inverse)
            
            return {
              price,
              outputAmount,
              priceImpact: quote.priceImpact,
              minimumReceived: outputAmount * 0.995 // 0.5% slippage tolerance
            };
          }
        }
      }

      // Use Cook DEX AMM pool reserves (constant product formula)
      const { marketDataService } = await import('./marketDataService');
      const ammData = await marketDataService.getAMMAccountData(tokenMint.toBase58());
      
      if (ammData && ammData.solReserves > 0 && ammData.tokenReserves > 0) {
        console.log('📊 Using Cook DEX AMM pool for quote:', {
          solReserves: ammData.solReserves,
          tokenReserves: ammData.tokenReserves,
          currentPrice: ammData.price
        });

        // Constant product formula: (x + Δx) * (y - Δy) = x * y
        // Where x = SOL reserves, y = token reserves
        const solReserves = ammData.solReserves; // Already in SOL (not lamports)
        const tokenReserves = ammData.tokenReserves; // Already in token units
        
        // Cook DEX fee: 0.25% (25 basis points)
        const feeBps = 25;
        const feeMultiplier = (10000 - feeBps) / 10000; // 0.9975
        
        if (isSOLToToken) {
          // Buying tokens with SOL
          // Δx = amount (SOL being added)
          // Δy = (y * Δx * fee) / (x + Δx * fee)
          const solIn = amount;
          const solInWithFee = solIn * feeMultiplier;
          const tokensOut = (tokenReserves * solInWithFee) / (solReserves + solInWithFee);
          
          const price = solIn / tokensOut; // Effective price per token
          const priceImpact = (solIn / solReserves) * 100; // Price impact percentage
          
          return {
            price,
            outputAmount: tokensOut,
            priceImpact: Math.min(priceImpact, 100), // Cap at 100%
            minimumReceived: tokensOut * 0.995 // 0.5% slippage tolerance
          };
        } else {
          // Selling tokens for SOL
          // Δy = amount (tokens being sold)
          // Δx = (x * Δy * fee) / (y - Δy * fee)
          const tokensIn = amount;
          const tokensInWithFee = tokensIn * feeMultiplier;
          const solOut = (solReserves * tokensInWithFee) / (tokenReserves - tokensInWithFee);
          
          const price = solOut / tokensIn; // Effective price per token
          const priceImpact = (tokensIn / tokenReserves) * 100; // Price impact percentage
          
          return {
            price,
            outputAmount: solOut,
            priceImpact: Math.min(priceImpact, 100), // Cap at 100%
            minimumReceived: solOut * 0.995 // 0.5% slippage tolerance
          };
        }
      }

      // Final fallback: Use current price from AMM data if available
      if (ammData && ammData.price > 0) {
        console.warn('⚠️ Using AMM price as fallback (no reserves available)');
        const currentPrice = ammData.price;
        
        if (isSOLToToken) {
          const tokensOut = amount / currentPrice;
          return {
            price: currentPrice,
            outputAmount: tokensOut,
            priceImpact: 0.1,
            minimumReceived: tokensOut * 0.995
          };
        } else {
          const solOut = amount * currentPrice;
          return {
            price: currentPrice,
            outputAmount: solOut,
            priceImpact: 0.1,
            minimumReceived: solOut * 0.995
          };
        }
      }

      // Fallback for bonding curve launches: Use bonding curve formula
      // This handles instant launches that don't have pools yet or have zero reserves
      try {
        const { launchDataService } = await import('./launchDataService');
        const launch = await launchDataService.getLaunchByTokenMint(tokenMint.toBase58());
        
        if (launch && launch.launchType === 'instant' && !launch.isGraduated) {
          const { bondingCurveService } = await import('./bondingCurveService');
          const bondingCurveConfig = {
            totalSupply: launch.totalSupply,
            curveType: 'linear' as const,
          };
          
          const currentTokensSold = launch.tokensSold || 0;
          
          // Cook DEX fee: 0.25% (25 basis points) - same as pool trades
          const feeBps = 25;
          const feeMultiplier = (10000 - feeBps) / 10000; // 0.9975
          
          if (isSOLToToken) {
            // Buying tokens with SOL using bonding curve
            // Calculate tokens received for SOL amount (with fee applied)
            const solAfterFee = amount * feeMultiplier;
            // calculateTokensForSol returns human-readable units
            const tokensOut = bondingCurveService.calculateTokensForSol(
              solAfterFee,
              currentTokensSold,
              bondingCurveConfig
            );
            
            const effectivePrice = tokensOut > 0 ? amount / tokensOut : 0;
            const remainingSupply = launch.totalSupply - currentTokensSold;
            const priceImpact = remainingSupply > 0 ? (tokensOut / remainingSupply) * 100 : 0;
            
            return {
              price: effectivePrice,
              outputAmount: tokensOut, // Human-readable format
              priceImpact: Math.min(priceImpact, 100),
              minimumReceived: tokensOut * 0.995 // 0.5% slippage tolerance
            };
        } else {
          // Selling tokens for SOL using bonding curve
          // amount is in human-readable token units
          // calculateSolForTokens expects tokensAmount in human-readable format
          const solBeforeFee = bondingCurveService.calculateSolForTokens(
            amount, // Already in human-readable format
            currentTokensSold,
            bondingCurveConfig
          );
          
          // calculateSolForTokens returns SOL (human-readable)
          const solOut = solBeforeFee * feeMultiplier; // Apply fee
          const effectivePrice = amount > 0 ? solOut / amount : 0;
          const priceImpact = currentTokensSold > 0 ? (amount / currentTokensSold) * 100 : 0;
          
          return {
            price: effectivePrice,
            outputAmount: solOut, // In SOL (human-readable)
            priceImpact: Math.min(priceImpact, 100),
            minimumReceived: solOut * 0.995 // 0.5% slippage tolerance
          };
        }
        }
      } catch (error) {
        console.warn('⚠️ Could not calculate bonding curve quote:', error);
      }

      // Last resort: Return error
      throw new Error('No liquidity pool found and not a bonding curve launch. Pool must exist for trading.');
    } catch (error) {
      console.error('❌ Error getting swap quote:', error);
      throw error instanceof Error ? error : new Error('Failed to get swap quote');
    }
  }

  /**
   * Buy tokens using instant swap (Raydium or Cook DEX)
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
      
      // Use Raydium if selected
      if (dexProvider === 'raydium') {
        try {
          const { raydiumService } = await import('./raydiumService');
          const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
          
          // Find pool
          const poolAddress = await raydiumService.findPool(tokenMintKey, WSOL_MINT);
          
          if (poolAddress) {
            console.log('✅ Found Raydium pool, executing swap...');
            
            const amountIn = BigInt(Math.floor(solAmount * 1e9));
            const quote = await raydiumService.getSwapQuote(
              poolAddress,
              WSOL_MINT,
              tokenMintKey,
              amountIn,
              50 // 0.5% slippage
            );
            
            if (quote) {
              const minAmountOut = quote.outputAmount * BigInt(9950) / BigInt(10000); // 0.5% slippage
              
              const signature = await raydiumService.swap(
                poolAddress,
                userKey,
                WSOL_MINT,
                tokenMintKey,
                amountIn,
                minAmountOut,
                signTransaction
              );
              
              return {
                success: true,
                signature,
                tokensReceived: Number(quote.outputAmount) / 1e9,
                solReceived: solAmount
              };
            }
          }
          
          console.log('⚠️ Raydium pool not found, falling back to Cook DEX');
        } catch (raydiumError) {
          console.error('❌ Raydium swap failed, falling back to Cook DEX:', raydiumError);
        }
      }
      
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
      
      // Get launch data to extract state fields
      let isInstantLaunch = 0;
      let isGraduated = 0;
      let tokensSold = 0;
      let totalSupply = 0;
      let creatorKey = PublicKey.default;
      
      try {
        const launchData = await launchDataService.getLaunchByTokenMint(tokenMintKey.toBase58());
        
        if (launchData) {
          isInstantLaunch = launchData.launchType === 'instant' ? 1 : 0;
          isGraduated = launchData.isGraduated === true ? 1 : 0;
          
          // Convert to raw units, but clamp to u64 max to prevent overflow
          // u64 max: 18,446,744,073,709,551,615 (2^64 - 1)
          const U64_MAX = BigInt('18446744073709551615');
          const rawTokensSold = BigInt(Math.floor((launchData.tokensSold || 0) * 1e9));
          tokensSold = Number(rawTokensSold > U64_MAX ? U64_MAX : rawTokensSold);
          
          const rawTotalSupply = BigInt(Math.floor((launchData.totalSupply || 0) * 1e9));
          totalSupply = Number(rawTotalSupply > U64_MAX ? U64_MAX : rawTotalSupply);
          
          if (launchData.creator) {
            creatorKey = new PublicKey(launchData.creator);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not get launch data for args, using defaults:', error);
      }
      
      // Cook AMM uses PlaceOrderArgs with proper Borsh serialization (Backend version)
      // Structure: side(u8) + limit_price(u64) + max_base_quantity(u64) + max_quote_quantity(u64) + order_type(u8) + client_order_id(u64) + limit(u16)
      // + is_instant_launch(u8) + is_graduated(u8) + tokens_sold(u64) + total_supply(u64) + creator_key(Pubkey/32 bytes)
      const argsBuffer = Buffer.alloc(86); // Exact size: 1 + 8 + 8 + 8 + 1 + 8 + 2 + 1 + 1 + 8 + 8 + 32 = 86 bytes
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
      
      // Write is_instant_launch (u8): 0 = false, 1 = true
      argsBuffer.writeUInt8(isInstantLaunch, offset);
      offset += 1;
      
      // Write is_graduated (u8): 0 = false, 1 = true
      argsBuffer.writeUInt8(isGraduated, offset);
      offset += 1;
      
      // Write tokens_sold (u64): current tokens sold for bonding curve
      argsBuffer.writeBigUInt64LE(BigInt(tokensSold), offset);
      offset += 8;
      
      // Write total_supply (u64): total supply for creator limit check
      argsBuffer.writeBigUInt64LE(BigInt(totalSupply), offset);
      offset += 8;
      
      // Write creator_key (Pubkey, 32 bytes)
      argsBuffer.set(creatorKey.toBytes(), offset);
      offset += 32;
      
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
      // Derive the AMM account using the same seeds as backend
      // Backend uses: [base_mint, quote_mint, b"CookAMM"] (sorted)
      const WSOL_MINT_BUY = new PublicKey('So11111111111111111111111111111111111111112');
      const baseFirstBuy = tokenMintKey.toString() < WSOL_MINT_BUY.toString();
      const ammSeedsBuy = baseFirstBuy
        ? [tokenMintKey.toBuffer(), WSOL_MINT_BUY.toBuffer(), Buffer.from('CookAMM')]
        : [WSOL_MINT_BUY.toBuffer(), tokenMintKey.toBuffer(), Buffer.from('CookAMM')];
      const [ammAccount] = PublicKey.findProgramAddressSync(ammSeedsBuy, PROGRAM_ID);
      
      // Check if graduation threshold will be met after this trade
      // If so, we'll include CreateRaydium instruction in the same transaction
      const GRADUATION_THRESHOLD_SOL = 30; // 30 SOL threshold
      const GRADUATION_THRESHOLD_LAMPORTS = GRADUATION_THRESHOLD_SOL * 1_000_000_000;
      let shouldCreateRaydiumPool = false;
      
      if (isInstantLaunch === 1 && isGraduated === 0) {
        try {
          const ammAccountInfo = await this.connection.getAccountInfo(ammAccount);
          const currentAmmBalance = ammAccountInfo?.lamports || 0;
          const balanceAfterTrade = currentAmmBalance + amountInLamports;
          
          console.log('🔍 Graduation check:', {
            currentBalance: currentAmmBalance / 1e9,
            tradeAmount: amountInLamports / 1e9,
            balanceAfterTrade: balanceAfterTrade / 1e9,
            threshold: GRADUATION_THRESHOLD_SOL,
            willMeetThreshold: balanceAfterTrade >= GRADUATION_THRESHOLD_LAMPORTS
          });
          
          // If this trade will push us over 30 SOL threshold, create Raydium pool
          if (balanceAfterTrade >= GRADUATION_THRESHOLD_LAMPORTS && currentAmmBalance < GRADUATION_THRESHOLD_LAMPORTS) {
            shouldCreateRaydiumPool = true;
            console.log('🚀 Graduation threshold will be met! Will create Raydium pool in same transaction');
          }
        } catch (error) {
          console.warn('⚠️ Could not check AMM balance for graduation:', error);
        }
      }
      
      // Derive cook_pda (needed as mint authority in invoke_signed)
      // Backend uses SOL_SEED (59957379) as u32.to_le_bytes()
      const SOL_SEED = 59957379;
      const [cookPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(SOL_SEED.toString(16).padStart(8, '0'), 'hex')], // Convert to bytes like to_le_bytes()
        PROGRAM_ID
      );
      
      // Actually, let's use the same method as the backend - u32.to_le_bytes()
      const solSeedBuffer = Buffer.alloc(4);
      solSeedBuffer.writeUInt32LE(SOL_SEED, 0);
      const [cookPdaCorrect] = PublicKey.findProgramAddressSync(
        [solSeedBuffer],
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

      // Find amm_base token account (the AMM pool's token account that holds all minted tokens)
      // PRIORITY 1: Try to get from Supabase first (fastest and most reliable)
      // PRIORITY 2: Query blockchain if Supabase doesn't have it
      let ammBaseTokenAccount: PublicKey | null = null;
      try {
        // PRIORITY 1: Try Supabase first (stored during launch creation)
        console.log('🔍 Searching for amm_base token account...');
        console.log('  AMM Account:', ammAccount.toBase58());
        console.log('  Token Mint:', tokenMintKey.toBase58());
        console.log('  📦 Checking Supabase first...');
        
        try {
          // Try launch metadata service first (Supabase)
          const { LaunchMetadataService } = await import('./launchMetadataService');
          const metadata = await LaunchMetadataService.getMetadataByTokenMint(tokenMintKey.toBase58());
          if (metadata && metadata.amm_base_token_account) {
            ammBaseTokenAccount = new PublicKey(metadata.amm_base_token_account);
            console.log('✅ Found amm_base from Supabase (launch metadata):', ammBaseTokenAccount.toBase58());
            
            // Verify it exists on-chain
            const verifyInfo = await this.connection.getAccountInfo(ammBaseTokenAccount).catch(() => null);
            if (verifyInfo) {
              console.log('✅ Verified amm_base from Supabase exists on-chain. Owner:', verifyInfo.owner.toBase58(), 'Data length:', verifyInfo.data.length);
            } else {
              console.warn('⚠️ amm_base from Supabase does not exist on-chain, will try blockchain query');
              ammBaseTokenAccount = null; // Mark as invalid, try blockchain query
            }
          } else {
            // Try launch data service as fallback
            const launchData = await launchDataService.getLaunchByTokenMint(tokenMintKey.toBase58());
            if (launchData && (launchData as any).ammBaseTokenAccount) {
              ammBaseTokenAccount = new PublicKey((launchData as any).ammBaseTokenAccount);
              console.log('✅ Found amm_base from launch data service:', ammBaseTokenAccount.toBase58());
              
              // Verify it exists on-chain
              const verifyInfo = await this.connection.getAccountInfo(ammBaseTokenAccount).catch(() => null);
              if (!verifyInfo) {
                console.warn('⚠️ amm_base from launch data service does not exist on-chain, will try blockchain query');
                ammBaseTokenAccount = null;
              }
            }
          }
        } catch (supabaseError) {
          console.warn('⚠️ Could not get amm_base from Supabase, will try blockchain query:', supabaseError);
        }
        
        // PRIORITY 2: Query blockchain if Supabase doesn't have it
        if (!ammBaseTokenAccount) {
          console.log('  🔗 Querying blockchain for amm_base...');
          
          // Query token accounts owned by the AMM account (PDA) for this token mint
          // Use connection.getParsedTokenAccountsByOwner which is available in @solana/web3.js
          const response = await this.connection.getParsedTokenAccountsByOwner(
            ammAccount,
            { mint: tokenMintKey },
            'confirmed'
          );
          
          console.log('  Found token accounts:', response.value?.length || 0);
          
          if (response.value && response.value.length > 0) {
            // Found the token account - this is amm_base
            const accountInfo = response.value[0];
            if (accountInfo && accountInfo.pubkey) {
              ammBaseTokenAccount = accountInfo.pubkey;
              console.log('✅ Found amm_base token account from blockchain:', ammBaseTokenAccount.toBase58());
              
              // Verify it immediately and check authority from parsed data
              const verifyInfo = await this.connection.getAccountInfo(ammBaseTokenAccount);
              if (verifyInfo) {
                console.log('✅ Verified amm_base exists. Owner:', verifyInfo.owner.toBase58(), 'Data length:', verifyInfo.data.length);
                
                // Check authority from parsed account data if available
                if (accountInfo.account && accountInfo.account.data && typeof accountInfo.account.data === 'object' && 'parsed' in accountInfo.account.data) {
                  const parsed = accountInfo.account.data.parsed as any;
                  if (parsed.info && parsed.info.owner) {
                    const parsedAuthority = new PublicKey(parsed.info.owner);
                    if (!parsedAuthority.equals(ammAccount)) {
                      console.error('❌ amm_base authority mismatch from parsed data!', {
                        ammBaseAccount: ammBaseTokenAccount.toBase58(),
                        expectedAuthority: ammAccount.toBase58(),
                        actualAuthority: parsedAuthority.toBase58()
                      });
                      // Don't throw here - let the later verification catch it with better error message
                      ammBaseTokenAccount = null; // Mark as invalid so we try other methods
                    } else {
                      console.log('✅ Verified amm_base authority from parsed data:', parsedAuthority.toBase58());
                    }
                  }
                }
              } else {
                console.warn('⚠️ amm_base account not found on-chain, will try fallback');
                ammBaseTokenAccount = null;
              }
            }
          }
          
          // If not found, try alternative methods
          if (!ammBaseTokenAccount) {
            console.warn('⚠️ No token account found via query, trying alternative methods...');
            
            // Try querying all token accounts for the AMM (without mint filter)
            try {
              // Query without filter to get all token accounts
              const allAccountsResponse = await this.connection.getParsedTokenAccountsByOwner(
                ammAccount,
                { programId: tokenProgram },
                'confirmed'
              );
              
              if (allAccountsResponse.value && allAccountsResponse.value.length > 0) {
                // Find the one that matches our token mint
                for (const acc of allAccountsResponse.value) {
                  if (acc.account && acc.account.data && typeof acc.account.data === 'object' && 'parsed' in acc.account.data) {
                    const parsed = acc.account.data.parsed as any;
                    if (parsed.info && parsed.info.mint === tokenMintKey.toBase58()) {
                      ammBaseTokenAccount = acc.pubkey;
                      console.log('✅ Found amm_base via alternative query:', ammBaseTokenAccount.toBase58());
                      break;
                    }
                  }
                }
              }
            } catch (altError) {
              console.warn('⚠️ Alternative query also failed:', altError);
            }
          }
          
          // Try deriving as PDA (new launches use PDA for amm_base)
          if (!ammBaseTokenAccount) {
            try {
              const { PROGRAM_ID } = await import('./nativeProgram');
              // Derive amm_base PDA: [amm.key, b"amm_base"]
              const [ammBasePDA] = PublicKey.findProgramAddressSync(
                [ammAccount.toBuffer(), Buffer.from('amm_base')],
                PROGRAM_ID
              );
              
              console.log('🔍 Derived amm_base PDA:', ammBasePDA.toBase58());
              console.log('  AMM Account used for derivation:', ammAccount.toBase58());
              
              // Verify the PDA account exists and has the correct mint
              const pdaAccountInfo = await this.connection.getParsedAccountInfo(ammBasePDA).catch(() => null);
              if (pdaAccountInfo?.value && typeof pdaAccountInfo.value.data === 'object' && 'parsed' in pdaAccountInfo.value.data) {
                const parsed = pdaAccountInfo.value.data.parsed as any;
                if (parsed.info && parsed.info.mint === tokenMintKey.toBase58()) {
                  ammBaseTokenAccount = ammBasePDA;
                  console.log('✅ Found amm_base as PDA (new launch format):', ammBaseTokenAccount.toBase58());
                } else {
                  console.warn('⚠️ Derived PDA exists but has wrong mint:', parsed.info?.mint, 'expected:', tokenMintKey.toBase58());
                }
              } else {
                console.warn('⚠️ Derived amm_base PDA does not exist or is not initialized:', ammBasePDA.toBase58());
              }
            } catch (pdaError) {
              console.warn('⚠️ Could not derive amm_base PDA:', pdaError);
            }
          }
        }
        
        // If still not found, try querying by program account ownership
        // The amm_base is a token account owned by the token program, with AMM as authority
        if (!ammBaseTokenAccount) {
          console.warn('⚠️ Trying alternative method: querying all token accounts...');
          try {
            // Get all token accounts for this mint
            const allTokenAccounts = await this.connection.getParsedProgramAccounts(
              tokenProgram,
              {
                filters: [
                  {
                    dataSize: 165, // Token account size
                  },
                  {
                    memcmp: {
                      offset: 0, // Mint is at offset 0 in token account
                      bytes: tokenMintKey.toBase58(),
                    },
                  },
                ],
              }
            );
            
            console.log(`  Found ${allTokenAccounts.length} token accounts for this mint`);
            
            // Find the one owned by AMM account
            for (const account of allTokenAccounts) {
              const accountInfo = account.account;
              if (accountInfo && accountInfo.data && typeof accountInfo.data === 'object' && 'parsed' in accountInfo.data) {
                const parsed = accountInfo.data.parsed as any;
                // Check if this account's owner/authority is the AMM account
                if (parsed.info && parsed.info.owner === ammAccount.toBase58()) {
                  ammBaseTokenAccount = account.pubkey;
                  console.log('✅ Found amm_base via program account query:', ammBaseTokenAccount.toBase58());
                  break;
                }
              }
            }
          } catch (programQueryError) {
            console.warn('⚠️ Program account query failed:', programQueryError);
          }
        }
      } catch (error) {
        console.error('❌ Error finding amm_base token account:', error);
        // Will throw error later if not found
      }
      
      // Create instruction keys according to Backend SwapCookAMM account structure
      // Backend expects:
      // 0-5: user, token_mint, amm_account, user_token_account, user_sol_account, ledger_wallet
      // 6: launch_data (optional, only if accounts.len() > 6)
      // 7: token_program (checked if accounts.len() > 7)
      // 8: cook_pda (checked if accounts.len() > 8)
      // 9: amm_base (checked if accounts.len() > 9) - REQUIRED for bonding curve transfers
      // Note: system_program is NOT in the accounts array - it's passed separately to invoke calls
      
      const instructionKeys = [
        { pubkey: userKey, isSigner: true, isWritable: true },        // user (0)
        { pubkey: tokenMintKey, isSigner: false, isWritable: true }, // token_mint (1)
        { pubkey: ammAccount, isSigner: false, isWritable: true },    // amm_account (2)
        { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // user_token_account (3)
        { pubkey: userSolAccount, isSigner: false, isWritable: true }, // user_sol_account (4)
        { pubkey: feesAccount, isSigner: false, isWritable: true },   // ledger_wallet (5)
      ];
      
      // Add launch data account at index 6 (if it exists)
      if (launchAccountInfo) {
        instructionKeys.push({ pubkey: launchDataAccount, isSigner: false, isWritable: true }); // launch_data (6)
      }
      
      // Add token_program at index 7
      instructionKeys.push({ pubkey: tokenProgram, isSigner: false, isWritable: false }); // token_program (7)
      
      // Add cook_pda at index 8
      instructionKeys.push({ pubkey: cookPdaCorrect, isSigner: false, isWritable: false }); // cook_pda (8)
      
      // Add amm_base at index 9 - REQUIRED for bonding curve transfers
      // Verify the account exists and is initialized before using it
      if (ammBaseTokenAccount) {
        try {
          // Verify the account exists and is initialized
          const ammBaseAccountInfo = await this.connection.getAccountInfo(ammBaseTokenAccount);
          if (!ammBaseAccountInfo) {
            console.error('❌ amm_base account does not exist:', ammBaseTokenAccount.toBase58());
            throw new Error(`amm_base token account does not exist: ${ammBaseTokenAccount.toBase58()}. The account must be created during launch.`);
          }
          
          // Check if it's a token account (owned by token program)
          const isTokenAccount = ammBaseAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID) || 
                                 ammBaseAccountInfo.owner.equals(TOKEN_PROGRAM_ID);
          
          if (!isTokenAccount) {
            console.error('❌ amm_base is not a token account. Owner:', ammBaseAccountInfo.owner.toBase58());
            throw new Error(`amm_base account is not a token account. Owner: ${ammBaseAccountInfo.owner.toBase58()}`);
          }
          
          // Check if account is initialized (has data)
          if (ammBaseAccountInfo.data.length === 0) {
            console.error('❌ amm_base account is not initialized (empty data)');
            throw new Error('amm_base token account is not initialized. It must be initialized during launch.');
          }
          
          // CRITICAL: Verify that the token account's authority is the AMM account
          // In Token-2022, the account structure is:
          // - Offset 0-31: mint (32 bytes)
          // - Offset 32-63: owner/authority (32 bytes)
          if (ammBaseAccountInfo.data.length >= 64) {
            const authorityBytes = ammBaseAccountInfo.data.slice(32, 64);
            const authorityPubkey = new PublicKey(authorityBytes);
            
            if (!authorityPubkey.equals(ammAccount)) {
              console.error('❌ amm_base authority mismatch!', {
                ammBaseAccount: ammBaseTokenAccount.toBase58(),
                expectedAuthority: ammAccount.toBase58(),
                actualAuthority: authorityPubkey.toBase58()
              });
              
              // Try to find the correct amm_base account by searching all token accounts
              console.log('🔍 Searching for correct amm_base account with proper authority...');
              let foundCorrectAccount = false;
              
              try {
                // Search all token accounts for this mint
                const allTokenAccounts = await this.connection.getParsedProgramAccounts(
                  tokenProgram,
                  {
                    filters: [
                      {
                        dataSize: 165, // Token account size
                      },
                      {
                        memcmp: {
                          offset: 0, // Mint is at offset 0 in token account
                          bytes: tokenMintKey.toBase58(),
                        },
                      },
                    ],
                  }
                );
                
                console.log(`  Found ${allTokenAccounts.length} token accounts for this mint`);
                
                // Check each account to find one with correct authority
                for (const account of allTokenAccounts) {
                  try {
                    const accountInfo = await this.connection.getAccountInfo(account.pubkey);
                    if (accountInfo && accountInfo.data.length >= 64) {
                      const accountAuthorityBytes = accountInfo.data.slice(32, 64);
                      const accountAuthority = new PublicKey(accountAuthorityBytes);
                      
                      if (accountAuthority.equals(ammAccount)) {
                        console.log('✅ Found correct amm_base account with proper authority:', account.pubkey.toBase58());
                        
                        // Verify this account is for the correct mint
                        const accountMintBytes = accountInfo.data.slice(0, 32);
                        const accountMint = new PublicKey(accountMintBytes);
                        if (accountMint.equals(tokenMintKey)) {
                          ammBaseTokenAccount = account.pubkey;
                          foundCorrectAccount = true;
                          console.log('✅ Verified correct amm_base account has correct mint and authority');
                          break;
                        } else {
                          console.warn('⚠️ Account has correct authority but wrong mint, skipping...');
                        }
                      }
                    }
                  } catch (e) {
                    // Skip this account if we can't read it
                    continue;
                  }
                }
              } catch (searchError) {
                console.warn('⚠️ Could not search for correct amm_base:', searchError);
              }
              
              // If we didn't find a correct account, we need to create one
              if (!foundCorrectAccount) {
                console.log('⚠️ No correct amm_base found. The account needs to be created with proper authority.');
                console.log('💡 Attempting to create amm_base account automatically...');
                
                // Automatically create amm_base if signTransaction is available
                if (signTransaction) {
                  try {
                    console.log('🔧 Creating new amm_base account with correct authority...');
                    const createResult = await this.createAmmBase(
                      userKey,
                      ammAccount,
                      tokenMintKey,
                      signTransaction
                    );
                    
                    if (createResult.success && createResult.ammBaseAddress) {
                      console.log('✅ Successfully created amm_base account:', createResult.ammBaseAddress);
                      ammBaseTokenAccount = new PublicKey(createResult.ammBaseAddress);
                      foundCorrectAccount = true;
                      
                      // Verify the newly created account
                      const newAccountInfo = await this.connection.getAccountInfo(ammBaseTokenAccount);
                      if (newAccountInfo && newAccountInfo.data.length >= 64) {
                        const newAuthorityBytes = newAccountInfo.data.slice(32, 64);
                        const newAuthority = new PublicKey(newAuthorityBytes);
                        if (newAuthority.equals(ammAccount)) {
                          console.log('✅ Verified newly created amm_base has correct authority');
                          
                          // Check if the account has tokens (it might be empty if tokens are in the old account)
                          try {
                            const parsedAccount = await this.connection.getParsedAccountInfo(ammBaseTokenAccount);
                            if (parsedAccount.value && typeof parsedAccount.value.data === 'object' && 'parsed' in parsedAccount.value.data) {
                              const parsed = parsedAccount.value.data.parsed as any;
                              if (parsed.info && parsed.info.tokenAmount) {
                                const balance = parsed.info.tokenAmount.uiAmount || 0;
                                if (balance === 0) {
                                  console.warn('⚠️ Newly created amm_base account is empty.');
                                  
                                  // Check if the old account has tokens
                                  try {
                                    const oldAccount = new PublicKey('G211TBJ2ELfPn4GTyhSx8e7JsRVfRhohV7o1cvFEEQb4');
                                    const oldParsedAccount = await this.connection.getParsedAccountInfo(oldAccount);
                                    if (oldParsedAccount.value && typeof oldParsedAccount.value.data === 'object' && 'parsed' in oldParsedAccount.value.data) {
                                      const oldParsed = oldParsedAccount.value.data.parsed as any;
                                      if (oldParsed.info && oldParsed.info.tokenAmount) {
                                        const oldBalance = oldParsed.info.tokenAmount.uiAmount || 0;
                                        if (oldBalance > 0) {
                                          console.error(`❌ CRITICAL: Old amm_base account has ${oldBalance} tokens but wrong authority. Tokens are stuck!`);
                                          console.error(`❌ Old account: G211TBJ2ELfPn4GTyhSx8e7JsRVfRhohV7o1cvFEEQb4`);
                                          console.error(`❌ New account: ${ammBaseTokenAccount.toBase58()}`);
                                          console.error(`❌ The swap will fail because tokens cannot be transferred from the old account.`);
                                          console.error(`❌ Solution: The launch needs to be fixed to transfer tokens to the new account, or tokens need to be manually transferred by the account with authority F9xhoKDyFu6yktYuvyT3PmqmEL6eZeZM1PxZWRGUgVNb`);
                                        }
                                      }
                                    }
                                  } catch (oldAccountError) {
                                    console.warn('⚠️ Could not check old amm_base balance:', oldAccountError);
                                  }
                                  
                                  console.warn('⚠️ The swap may fail with "insufficient funds" error because amm_base is empty.');
                                } else {
                                  console.log(`✅ New amm_base account has ${balance} tokens`);
                                }
                              }
                            }
                          } catch (balanceError) {
                            console.warn('⚠️ Could not check amm_base balance:', balanceError);
                          }
                        } else {
                          console.error('❌ Newly created amm_base still has wrong authority!');
                          throw new Error('Failed to create amm_base with correct authority');
                        }
                      }
                    } else {
                      throw new Error(createResult.error || 'Failed to create amm_base account');
                    }
                  } catch (createError) {
                    console.error('❌ Failed to automatically create amm_base:', createError);
                    throw new Error(
                      `amm_base token account has incorrect authority. Expected: ${ammAccount.toBase58()}, Found: ${authorityPubkey.toBase58()}. ` +
                      `The amm_base account (${ammBaseTokenAccount.toBase58()}) was created with the wrong authority during launch. ` +
                      `Automatic creation failed: ${createError instanceof Error ? createError.message : 'Unknown error'}. ` +
                      `Please use the "Fix amm_base" button or call createAmmBase() manually.`
                    );
                  }
                } else {
                  // signTransaction not available, throw helpful error
                  throw new Error(
                    `amm_base token account has incorrect authority. Expected: ${ammAccount.toBase58()}, Found: ${authorityPubkey.toBase58()}. ` +
                    `The amm_base account (${ammBaseTokenAccount.toBase58()}) was created with the wrong authority during launch. ` +
                    `Please use the "Fix amm_base" button or call createAmmBase() to create a new account with the correct authority.`
                  );
                }
              }
            } else {
              console.log('✅ Verified amm_base authority matches AMM account:', authorityPubkey.toBase58());
            }
          } else {
            console.warn('⚠️ Could not verify amm_base authority (data too short)');
          }
          
          console.log('✅ Verified amm_base token account exists, is initialized, and has correct authority');
          instructionKeys.push({ pubkey: ammBaseTokenAccount, isSigner: false, isWritable: true }); // amm_base (9)
        } catch (error) {
          console.error('❌ Error verifying amm_base account:', error);
          throw new Error(`amm_base token account verification failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the launch was completed successfully and the amm_base account was created.`);
        }
      } else {
        // If we couldn't find amm_base, check on-chain and provide detailed error message
        console.log('🔍 amm_base not found, running comprehensive diagnostic check...');
        const onChainCheck = await this.checkAmmBaseOnChain(ammAccount, tokenMintKey);
        
        if (onChainCheck.exists && onChainCheck.address) {
          // Found it on-chain but our query missed it - use the found address
          console.log('✅ Found amm_base on-chain via diagnostic check:', onChainCheck.address);
          console.log('  Account info:', onChainCheck.accountInfo);
          ammBaseTokenAccount = new PublicKey(onChainCheck.address);
          
          // Verify it's valid before using
          try {
            const verifyInfo = await this.connection.getAccountInfo(ammBaseTokenAccount);
            if (!verifyInfo || verifyInfo.data.length === 0) {
              throw new Error('amm_base account found but not initialized');
            }
            
            // Verify authority matches AMM account
            if (verifyInfo.data.length >= 64) {
              const authorityBytes = verifyInfo.data.slice(32, 64);
              const authorityPubkey = new PublicKey(authorityBytes);
              
              if (!authorityPubkey.equals(ammAccount)) {
                console.error('❌ amm_base from diagnostic check has wrong authority!', {
                  ammBaseAccount: ammBaseTokenAccount.toBase58(),
                  expectedAuthority: ammAccount.toBase58(),
                  actualAuthority: authorityPubkey.toBase58()
                });
                throw new Error(`amm_base account has incorrect authority. Expected: ${ammAccount.toBase58()}, Found: ${authorityPubkey.toBase58()}`);
              }
              
              console.log('✅ Verified amm_base authority from diagnostic check:', authorityPubkey.toBase58());
            }
            
            instructionKeys.push({ pubkey: ammBaseTokenAccount, isSigner: false, isWritable: true }); // amm_base (9)
            console.log('✅ Verified and using amm_base from diagnostic check');
          } catch (verifyError) {
            console.error('❌ amm_base verification failed:', verifyError);
            throw new Error(`amm_base account found but invalid: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
          }
        } else {
          // Really doesn't exist - provide detailed error with actionable steps
          const diagnosticInfo = onChainCheck.error || 'Account not found on-chain';
          
          // Check if AMM account itself exists
          const ammAccountInfo = await this.connection.getAccountInfo(ammAccount);
          const ammExists = ammAccountInfo && ammAccountInfo.lamports > 0;
          
          const errorMessage = `❌ Could not find amm_base token account for token ${tokenMintKey.toBase58()}.

🔍 Diagnostic Results:
- AMM Account exists: ${ammExists ? '✅ Yes' : '❌ No'}
- amm_base found: ❌ No
- Error: ${diagnosticInfo}

📋 What this means:
The amm_base token account is required for bonding curve trades. This account should have been created during the launch transaction.

🔧 Possible Solutions:

1. ✅ CHECK FIRST: Verify the launch transaction completed successfully
   - Check transaction signature on Solana Explorer
   - Look for "amm_base initialized" in transaction logs

2. ✅ CHECK ON-CHAIN: View the AMM account on Solana Explorer
   - AMM Account: https://solscan.io/account/${ammAccount.toBase58()}?cluster=devnet
   - Look for token accounts owned by this AMM account
   - If you see a token account for this mint, note its address

3. ✅ IF ACCOUNT EXISTS: The account may exist but we can't find it
   - Try refreshing the page
   - Check browser console for detailed logs
   - The diagnostic check should have found it if it exists

4. ⚠️ IF ACCOUNT DOESN'T EXIST: The launch may not have completed successfully
   - Check the launch transaction for errors
   - The amm_base account creation may have failed
   - You may need to create a new launch

💡 Quick Fix:

Look for the "Fix Now" button in the error toast above - it will automatically create amm_base for you!

If the button doesn't appear, you can also use the helper function. The error toast should guide you through it.`;

          console.error('❌', errorMessage);
          console.error('🔍 Full diagnostic details:', {
            onChainCheck,
            ammAccountExists: ammExists,
            ammAccount: ammAccount.toBase58(),
            tokenMint: tokenMintKey.toBase58()
          });
          throw new Error(errorMessage);
        }
      }
      
      // Add cook_base_token at index 10 - Used as fallback when amm_base is empty
      // Derive cook_base_token ATA (for cook_pda to hold initial token supply)
      const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
      const cookBaseTokenATA = getAssociatedTokenAddressSync(
        tokenMintKey,
        cookPdaCorrect,
        true, // allowOwnerOffCurve = true (cook_pda is a PDA, which is off-curve)
        tokenProgram // Token-2022 program
      );
      instructionKeys.push({ pubkey: cookBaseTokenATA, isSigner: false, isWritable: true }); // cook_base_token (10)
      
      // Add system_program at index 11 - REQUIRED for system_instruction::transfer calls
      instructionKeys.push({ pubkey: SystemProgram.programId, isSigner: false, isWritable: false }); // system_program (11)

      // Add amm_quote at index 12 - REQUIRED for wrapped SOL transfers
      const ammQuoteATA = getAssociatedTokenAddressSync(
        WSOL_MINT_BUY, // Quote token is WSOL
        ammAccount,
        true, // allowOwnerOffCurve = true (ammAccount is a PDA)
        TOKEN_2022_PROGRAM_ID // WSOL is Token-2022
      );
      instructionKeys.push({ pubkey: ammQuoteATA, isSigner: false, isWritable: true }); // amm_quote (12)

      // Add quote_token_program at index 13 - REQUIRED for wrapped SOL transfers
      instructionKeys.push({ pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }); // quote_token_program (13)

      // Add user_wsol_account at index 14 - REQUIRED for unwrapping SOL on sell
      const userWsolATA = getAssociatedTokenAddressSync(
        WSOL_MINT_BUY,
        userKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      instructionKeys.push({ pubkey: userWsolATA, isSigner: false, isWritable: true }); // user_wsol_account (14)

      // Add ledger_wsol_account at index 15 - REQUIRED for fee collection in WSOL
      const ledgerWsolATA = getAssociatedTokenAddressSync(
        WSOL_MINT_BUY,
        feesAccount,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      instructionKeys.push({ pubkey: ledgerWsolATA, isSigner: false, isWritable: true }); // ledger_wsol_account (15)

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
        const pubkeyStr = account.pubkey instanceof PublicKey 
          ? account.pubkey.toBase58() 
          : String(account.pubkey);
        console.log(`Account ${index}:`, {
          pubkey: pubkeyStr,
          isSigner: account.isSigner,
          isWritable: account.isWritable,
          exists: index < accountChecks.length ? !!accountChecks[index] : 'not checked'
        });
      });

      // Verify AMM account derivation matches backend
      const WSOL_MINT_VERIFY = new PublicKey('So11111111111111111111111111111111111111112');
      const baseFirstVerify = tokenMintKey.toString() < WSOL_MINT_VERIFY.toString();
      const ammSeedsVerify = baseFirstVerify
        ? [tokenMintKey.toBuffer(), WSOL_MINT_VERIFY.toBuffer(), Buffer.from('CookAMM')]
        : [WSOL_MINT_VERIFY.toBuffer(), tokenMintKey.toBuffer(), Buffer.from('CookAMM')];
      const [expectedAmmAccount] = PublicKey.findProgramAddressSync(ammSeedsVerify, PROGRAM_ID);
      console.log('🔍 AMM Account Verification:', {
        derivedAmmAccount: expectedAmmAccount.toBase58(),
        usedAmmAccount: ammAccount.toBase58(),
        accountsMatch: expectedAmmAccount.equals(ammAccount),
        ammAccountExists: !!accountChecks[2],
        derivationSeeds: baseFirstVerify ? '[base, WSOL, CookAMM]' : '[WSOL, base, CookAMM]'
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
      
      // If graduation threshold will be met, add CreateRaydium instruction to same transaction
      // This makes pool creation atomic with the swap
      if (shouldCreateRaydiumPool) {
        console.log('🚀 Graduation threshold will be met! Adding CreateRaydium instruction...');
        
        try {
          const createRaydiumInstruction = await this.buildCreateRaydiumInstruction(
            userKey,
            tokenMintKey,
            ammAccount,
            totalSupply
          );
          
          if (createRaydiumInstruction) {
            transaction.add(createRaydiumInstruction);
            console.log('✅ CreateRaydium instruction added to transaction');
          } else {
            console.warn('⚠️ Could not build CreateRaydium instruction, will rely on backend event');
          }
        } catch (error) {
          console.error('❌ Error building CreateRaydium instruction:', error);
          console.warn('⚠️ Will rely on backend GRADUATION_THRESHOLD_MET event for pool creation');
        }
      }
      
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
          
          // Check if it's a "tokens not available" error (Custom: 3)
          if (error && typeof error === 'object' && 'Custom' in error && error.Custom === 3) {
            // Both amm_base and cook_base_token are empty
            // Try to find where tokens actually are
            console.error('🔍 Diagnosing token location issue...');
            try {
              const { TOKEN_2022_PROGRAM_ID } = await import('@solana/spl-token');
              const { getMint } = await import('@solana/spl-token');
              
              // Get mint info to check supply
              const mintInfo = await getMint(this.connection, tokenMintKey, 'confirmed', TOKEN_2022_PROGRAM_ID).catch(() => 
                getMint(this.connection, tokenMintKey, 'confirmed')
              );
              
              console.error(`📊 Mint supply: ${mintInfo.supply.toString()}`);
              
              // Try to find all token accounts for this mint
              // Check known accounts first, then try to find others
              try {
                const accountsWithBalance: Array<{address: string, balance: string, owner: string}> = [];
                
                // Check known accounts: amm_base, cook_base_token, and the old amm_base
                const knownAccounts = [
                  { address: ammBaseTokenAccount, name: 'amm_base (current)' },
                  { address: cookBaseTokenATA, name: 'cook_base_token' },
                  { address: new PublicKey('G211TBJ2ELfPn4GTyhSx8e7JsRVfRhohV7o1cvFEEQb4'), name: 'amm_base (old, wrong authority)' },
                ];
                
                for (const knownAccount of knownAccounts) {
                  try {
                    const parsed = await this.connection.getParsedAccountInfo(knownAccount.address);
                    if (parsed.value && typeof parsed.value.data === 'object' && 'parsed' in parsed.value.data) {
                      const parsedData = parsed.value.data.parsed as any;
                      if (parsedData.info && parsedData.info.mint === tokenMintKey.toBase58() && parsedData.info.tokenAmount) {
                        const balance = parsedData.info.tokenAmount.uiAmount || 0;
                        const owner = parsedData.info.owner || 'unknown';
                        if (balance > 0) {
                          accountsWithBalance.push({
                            address: knownAccount.address.toBase58(),
                            balance: balance.toString(),
                            owner: owner.toString(),
                          });
                          console.error(`  ${knownAccount.name}: ${balance} tokens (owner: ${owner})`);
                        }
                      }
                    }
                  } catch (e) {
                    // Account might not exist or be unparseable
                  }
                }
                
                // Also try to find other token accounts by checking common owners
                // This is a simplified approach - full scan would be too expensive
                try {
                  const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
                  const userTokenATA = getAssociatedTokenAddressSync(tokenMintKey, userKey, false, TOKEN_2022_PROGRAM_ID);
                  const userParsed = await this.connection.getParsedAccountInfo(userTokenATA).catch(() => null);
                  if (userParsed?.value && typeof userParsed.value.data === 'object' && 'parsed' in userParsed.value.data) {
                    const parsedData = userParsed.value.data.parsed as any;
                    if (parsedData.info && parsedData.info.tokenAmount) {
                      const balance = parsedData.info.tokenAmount.uiAmount || 0;
                      if (balance > 0) {
                        accountsWithBalance.push({
                          address: userTokenATA.toBase58(),
                          balance: balance.toString(),
                          owner: 'user',
                        });
                        console.error(`  User token account: ${balance} tokens`);
                      }
                    }
                  }
                } catch (e) {
                  // Skip if can't check user account
                }
                
                if (accountsWithBalance.length > 0) {
                  console.error(`💰 Token accounts with balance:`);
                  accountsWithBalance.forEach(acc => {
                    console.error(`  - ${acc.address}: ${acc.balance} tokens (owner: ${acc.owner})`);
                  });
                  
                  // Check if tokens are in the old amm_base account
                  const oldAccount = accountsWithBalance.find(acc => 
                    acc.address === 'G211TBJ2ELfPn4GTyhSx8e7JsRVfRhohV7o1cvFEEQb4'
                  );
                  
                  if (oldAccount) {
                    throw new Error(
                      `Tokens are stuck in the old amm_base account (${oldAccount.address}) with wrong authority. ` +
                      `The account has ${oldAccount.balance} tokens but cannot be used because the authority doesn't match the AMM account. ` +
                      `Please contact support to recover these tokens or re-launch the token with proper setup.`
                    );
                  }
                  
                  throw new Error(
                    `Tokens are not in the expected accounts (amm_base or cook_base_token). ` +
                    `Found ${accountsWithBalance.length} account(s) with tokens. ` +
                    `Please check the console for details. The swap cannot proceed until tokens are transferred to amm_base with the correct authority.`
                  );
                } else {
                  throw new Error(
                    `No tokens found in any token accounts. Mint supply: ${mintInfo.supply.toString()}, ` +
                    `but all token accounts are empty. This suggests tokens were never minted or were burned. ` +
                    `Please verify the launch was completed successfully.`
                  );
                }
              } catch (diagnosticError: any) {
                // If diagnostic fails, provide a generic error
                if (diagnosticError.message && diagnosticError.message.includes('stuck') || diagnosticError.message.includes('not in the expected')) {
                  throw diagnosticError;
                }
                console.error('⚠️ Could not complete full diagnostic:', diagnosticError);
                throw new Error(
                  `Both amm_base and cook_base_token are empty. Tokens may be stuck in an account with wrong authority. ` +
                  `Check the simulation logs above for more details. Error code: Custom(3)`
                );
              }
            } catch (diagnosticError: any) {
              // If we already threw a specific error, re-throw it
              if (diagnosticError.message) {
                throw diagnosticError;
              }
              throw new Error(
                `Both amm_base and cook_base_token are empty. Tokens may be stuck in an account with wrong authority. ` +
                `Check the simulation logs above for more details. Error code: Custom(3)`
              );
            }
          }
          
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
      
      // Update tokens_sold, current_price, and pool_sol_balance in Supabase after successful buy
      try {
        const { LaunchMetadataService } = await import('./launchMetadataService');
        const { launchDataService } = await import('./launchDataService');
        const { bondingCurveService } = await import('./bondingCurveService');
        const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
        
        // Get updated tokensSold from blockchain
        const launchData = await launchDataService.getLaunchByTokenMint(tokenMintKey.toBase58());
        if (launchData && launchData.tokensSold !== undefined) {
          const tokensSoldHuman = launchData.tokensSold; // Already in human-readable units
          
          // Calculate updated current_price from bonding curve
          const metadata = await LaunchMetadataService.getMetadataByTokenMint(tokenMintKey.toBase58());
          const totalSupply = metadata?.total_supply || launchData.totalSupply || 1000000000;
          const decimals = metadata?.decimals || launchData.decimals || 9;
          const currentPrice = bondingCurveService.calculatePrice({
            totalSupply,
            tokensSold: tokensSoldHuman,
            decimals
          });
          
          // Get updated pool_sol_balance from amm_quote (WSOL account)
          let poolSolBalance = 0;
          try {
            const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
            const ammQuoteATA = getAssociatedTokenAddressSync(
              WSOL_MINT,
              ammAccount,
              true, // allowOwnerOffCurve = true (ammAccount is a PDA)
              TOKEN_2022_PROGRAM_ID
            );
            const ammQuoteInfo = await this.connection.getAccountInfo(ammQuoteATA);
            if (ammQuoteInfo && ammQuoteInfo.data.length > 0) {
              const amount = ammQuoteInfo.data.readBigUInt64LE(64);
              poolSolBalance = Number(amount) / 1e9; // Convert to SOL
            }
          } catch (error) {
            console.warn('⚠️ Could not get pool_sol_balance, keeping existing value:', error);
          }
          
          // Update all fields in Supabase
          await LaunchMetadataService.updateMetadata(tokenMintKey.toBase58(), {
            tokens_sold: tokensSoldHuman,
            current_price: currentPrice,
            pool_sol_balance: poolSolBalance
          });
          console.log('✅ Updated launch metadata in Supabase:', {
            tokens_sold: tokensSoldHuman,
            current_price: currentPrice,
            pool_sol_balance: poolSolBalance
          });
        }
      } catch (updateError) {
        console.warn('⚠️ Failed to update launch metadata in Supabase (non-critical):', updateError);
      }
      
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
      
      // Use Raydium if selected
      if (dexProvider === 'raydium') {
        try {
          const { raydiumService } = await import('./raydiumService');
          const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
          
          // Find pool
          const poolAddress = await raydiumService.findPool(tokenMintKey, WSOL_MINT);
          
          if (poolAddress) {
            console.log('✅ Found Raydium pool, executing swap...');
            
            // Get token decimals (default to 9)
            const mintInfo = await this.connection.getAccountInfo(tokenMintKey);
            const decimals = mintInfo ? 9 : 9; // Simplified - would need proper parsing
            
            const amountIn = BigInt(Math.floor(tokenAmount * Math.pow(10, decimals)));
            const quote = await raydiumService.getSwapQuote(
              poolAddress,
              tokenMintKey,
              WSOL_MINT,
              amountIn,
              50 // 0.5% slippage
            );
            
            if (quote) {
              const minAmountOut = quote.outputAmount * BigInt(9950) / BigInt(10000); // 0.5% slippage
              
              const signature = await raydiumService.swap(
                poolAddress,
                userKey,
                tokenMintKey,
                WSOL_MINT,
                amountIn,
                minAmountOut,
                signTransaction
              );
              
              return {
                success: true,
                signature,
                tokensReceived: tokenAmount,
                solReceived: Number(quote.outputAmount) / 1e9
              };
            }
          }
          
          console.log('⚠️ Raydium pool not found, falling back to Cook DEX');
        } catch (raydiumError) {
          console.error('❌ Raydium swap failed, falling back to Cook DEX:', raydiumError);
        }
      }
      
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
      
      // Derive the AMM account using the same seeds as backend
      // Backend uses: [base_mint, quote_mint, b"CookAMM"] (sorted)
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const baseFirst = tokenMintKey.toString() < WSOL_MINT.toString();
      const ammSeeds = baseFirst
        ? [tokenMintKey.toBuffer(), WSOL_MINT.toBuffer(), Buffer.from('CookAMM')]
        : [WSOL_MINT.toBuffer(), tokenMintKey.toBuffer(), Buffer.from('CookAMM')];
      const [ammAccount] = PublicKey.findProgramAddressSync(ammSeeds, PROGRAM_ID);
      
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
        
        // Get launch data to extract state fields
        let isInstantLaunch = 0;
        let isGraduated = 0;
        let tokensSold = 0;
        let totalSupply = 0;
        let creatorKey = PublicKey.default;
        
        try {
          const launchData = await launchDataService.getLaunchByTokenMint(tokenMintKey.toBase58());
          if (launchData) {
            isInstantLaunch = launchData.launchType === 'instant' ? 1 : 0;
            isGraduated = launchData.isGraduated === true ? 1 : 0;
            
            // Convert to raw units, but clamp to u64 max to prevent overflow
            const U64_MAX = BigInt('18446744073709551615');
            const rawTokensSold = BigInt(Math.floor((launchData.tokensSold || 0) * 1e9));
            tokensSold = Number(rawTokensSold > U64_MAX ? U64_MAX : rawTokensSold);
            
            const rawTotalSupply = BigInt(Math.floor((launchData.totalSupply || 0) * 1e9));
            totalSupply = Number(rawTotalSupply > U64_MAX ? U64_MAX : rawTotalSupply);
            
            if (launchData.creator) {
              creatorKey = new PublicKey(launchData.creator);
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not get launch data for sell args, using defaults:', error);
        }
        
        // Use PlaceOrderArgs structure like buy instruction (86 bytes with new fields)
        const argsBuffer = Buffer.alloc(86); // Exact size: 1 + 8 + 8 + 8 + 1 + 8 + 2 + 1 + 1 + 8 + 8 + 32 = 86 bytes
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
        offset += 2;
        
        // Write is_instant_launch (u8): 0 = false, 1 = true
        argsBuffer.writeUInt8(isInstantLaunch, offset);
        offset += 1;
        
        // Write is_graduated (u8): 0 = false, 1 = true
        argsBuffer.writeUInt8(isGraduated, offset);
        offset += 1;
        
        // Write tokens_sold (u64): current tokens sold for bonding curve
        argsBuffer.writeBigUInt64LE(BigInt(tokensSold), offset);
        offset += 8;
        
        // Write total_supply (u64): total supply for creator limit check
        argsBuffer.writeBigUInt64LE(BigInt(totalSupply), offset);
        offset += 8;
        
        // Write creator_key (Pubkey, 32 bytes)
        argsBuffer.set(creatorKey.toBytes(), offset);
        offset += 32;
        
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
      
      // Derive cook_pda (needed for mint authority)
      const SOL_SEED = 59957379;
      const solSeedBuffer = Buffer.alloc(4);
      solSeedBuffer.writeUInt32LE(SOL_SEED, 0);
      const [cookPdaCorrect] = PublicKey.findProgramAddressSync(
        [solSeedBuffer],
        PROGRAM_ID
      );
      
      // Find amm_base token account (for bonding curve sells)
      // PRIORITY 1: Try to get from Supabase first (fastest and most reliable)
      // PRIORITY 2: Query blockchain if Supabase doesn't have it
      let ammBaseTokenAccount: PublicKey | null = null;
      try {
        // PRIORITY 1: Try Supabase first (stored during launch creation)
        console.log('🔍 Searching for amm_base token account (sell)...');
        console.log('  AMM Account:', ammAccount.toBase58());
        console.log('  Token Mint:', tokenMintKey.toBase58());
        console.log('  📦 Checking Supabase first...');
        
        try {
          // Try launch metadata service first (Supabase)
          const { LaunchMetadataService } = await import('./launchMetadataService');
          const metadata = await LaunchMetadataService.getMetadataByTokenMint(tokenMintKey.toBase58());
          if (metadata && metadata.amm_base_token_account) {
            ammBaseTokenAccount = new PublicKey(metadata.amm_base_token_account);
            console.log('✅ Found amm_base from Supabase (launch metadata) for sell:', ammBaseTokenAccount.toBase58());
            
            // Verify it exists on-chain
            const verifyInfo = await this.connection.getAccountInfo(ammBaseTokenAccount).catch(() => null);
            if (!verifyInfo) {
              console.warn('⚠️ amm_base from Supabase does not exist on-chain, will try blockchain query');
              ammBaseTokenAccount = null; // Mark as invalid, try blockchain query
            }
          } else {
            // Try launch data service as fallback
            const launchData = await launchDataService.getLaunchByTokenMint(tokenMintKey.toBase58());
            if (launchData && (launchData as any).ammBaseTokenAccount) {
              ammBaseTokenAccount = new PublicKey((launchData as any).ammBaseTokenAccount);
              console.log('✅ Found amm_base from launch data service for sell:', ammBaseTokenAccount.toBase58());
              
              // Verify it exists on-chain
              const verifyInfo = await this.connection.getAccountInfo(ammBaseTokenAccount).catch(() => null);
              if (!verifyInfo) {
                console.warn('⚠️ amm_base from launch data service does not exist on-chain, will try blockchain query');
                ammBaseTokenAccount = null;
              }
            }
          }
        } catch (supabaseError) {
          console.warn('⚠️ Could not get amm_base from Supabase for sell, will try blockchain query:', supabaseError);
        }
        
        // PRIORITY 2: Query blockchain if Supabase doesn't have it
        if (!ammBaseTokenAccount) {
          console.log('  🔗 Querying blockchain for amm_base (sell)...');
          
          // Use connection.getParsedTokenAccountsByOwner which is available in @solana/web3.js
          const response = await this.connection.getParsedTokenAccountsByOwner(
            ammAccount,
            { mint: tokenMintKey },
            'confirmed'
          );
          
          if (response.value && response.value.length > 0) {
            const accountInfo = response.value[0];
            if (accountInfo.pubkey) {
              ammBaseTokenAccount = accountInfo.pubkey;
              console.log('✅ Found amm_base token account from blockchain for sell:', ammBaseTokenAccount.toBase58());
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not find amm_base token account for sell:', error);
      }
      
      // Backend account structure for SwapCookAMM (matches buy path):
      // 0-5: user, token_mint, amm_account, user_token_account, user_sol_account, ledger_wallet
      // 6: launch_data (optional)
      // 7: token_program
      // 8: cook_pda
      // 9: amm_base (optional, for bonding curve)
      // 10: system_program
      const instructionKeys = [
        { pubkey: userKey, isSigner: true, isWritable: true },           // user (0)
        { pubkey: tokenMintKey, isSigner: false, isWritable: true },     // token_mint (1)
        { pubkey: ammAccount, isSigner: false, isWritable: true },       // amm_account (2)
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },  // user_token_account (3)
        { pubkey: userSolAccount, isSigner: false, isWritable: true },   // user_sol_account (4)
        { pubkey: feesAccount, isSigner: false, isWritable: true },       // ledger_wallet (5)
      ];
      
      // Add launch_data at index 6 (if it exists)
      if (launchAccountInfo) {
        instructionKeys.push({ pubkey: launchDataAccount, isSigner: false, isWritable: true }); // launch_data (6)
      }
      
      // Add token_program at index 7
      instructionKeys.push({ pubkey: tokenProgram, isSigner: false, isWritable: false }); // token_program (7)
      
      // Add cook_pda at index 8
      instructionKeys.push({ pubkey: cookPdaCorrect, isSigner: false, isWritable: false }); // cook_pda (8)
      
      // Add amm_base at index 9 (optional, for bonding curve)
      if (ammBaseTokenAccount) {
        instructionKeys.push({ pubkey: ammBaseTokenAccount, isSigner: false, isWritable: true }); // amm_base (9)
      } else {
        // Use a dummy token account address that's NOT System Program to avoid conflicts
        const dummyTokenAccount = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'); // SPL Token Program
        instructionKeys.push({ pubkey: dummyTokenAccount, isSigner: false, isWritable: true }); // Placeholder (9)
      }
      
      // Add cook_base_token at index 10 - Used as fallback when amm_base is empty (for sell, usually not needed)
      const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
      const cookBaseTokenATA = getAssociatedTokenAddressSync(
        tokenMintKey,
        cookPdaCorrect,
        true, // allowOwnerOffCurve = true (cook_pda is a PDA, which is off-curve)
        tokenProgram // Token-2022 program
      );
      instructionKeys.push({ pubkey: cookBaseTokenATA, isSigner: false, isWritable: true }); // cook_base_token (10)
      
      // Add system_program at index 11 - REQUIRED for system_instruction::transfer calls
      instructionKeys.push({ pubkey: SystemProgram.programId, isSigner: false, isWritable: false }); // system_program (11)

      // Add amm_quote at index 12 - REQUIRED for wrapped SOL transfers
      const WSOL_MINT_SELL = new PublicKey('So11111111111111111111111111111111111111112');
      const ammQuoteATASell = getAssociatedTokenAddressSync(
        WSOL_MINT_SELL, // Quote token is WSOL
        ammAccount,
        true, // allowOwnerOffCurve = true (ammAccount is a PDA)
        TOKEN_2022_PROGRAM_ID // WSOL is Token-2022
      );
      instructionKeys.push({ pubkey: ammQuoteATASell, isSigner: false, isWritable: true }); // amm_quote (12)

      // Add quote_token_program at index 13 - REQUIRED for wrapped SOL transfers
      instructionKeys.push({ pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }); // quote_token_program (13)

      // Add user_wsol_account at index 14 - REQUIRED for unwrapping SOL on sell
      const userWsolATASell = getAssociatedTokenAddressSync(
        WSOL_MINT_SELL,
        userKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      instructionKeys.push({ pubkey: userWsolATASell, isSigner: false, isWritable: true }); // user_wsol_account (14)

      // Add ledger_wsol_account at index 15 - REQUIRED for fee collection in WSOL
      const ledgerWsolATASell = getAssociatedTokenAddressSync(
        WSOL_MINT_SELL,
        feesAccount,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      instructionKeys.push({ pubkey: ledgerWsolATASell, isSigner: false, isWritable: true }); // ledger_wsol_account (15)
      
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
        
        // Update tokens_sold, current_price, and pool_sol_balance in Supabase after successful sell
        try {
          const { LaunchMetadataService } = await import('./launchMetadataService');
          const { launchDataService } = await import('./launchDataService');
          const { bondingCurveService } = await import('./bondingCurveService');
          const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
          
          // Get updated tokensSold from blockchain
          const launchData = await launchDataService.getLaunchByTokenMint(tokenMintKey.toBase58());
          if (launchData && launchData.tokensSold !== undefined) {
            const tokensSoldHuman = launchData.tokensSold; // Already in human-readable units
            
            // Calculate updated current_price from bonding curve
            const metadata = await LaunchMetadataService.getMetadataByTokenMint(tokenMintKey.toBase58());
            const totalSupply = metadata?.total_supply || launchData.totalSupply || 1000000000;
            const decimals = metadata?.decimals || launchData.decimals || 9;
            const currentPrice = bondingCurveService.calculatePrice({
              totalSupply,
              tokensSold: tokensSoldHuman,
              decimals
            });
            
            // Get updated pool_sol_balance from amm_quote (WSOL account)
            let poolSolBalance = 0;
            try {
              const WSOL_MINT_SELL = new PublicKey('So11111111111111111111111111111111111111112');
              const ammQuoteATASell = getAssociatedTokenAddressSync(
                WSOL_MINT_SELL,
                ammAccount,
                true, // allowOwnerOffCurve = true (ammAccount is a PDA)
                TOKEN_2022_PROGRAM_ID
              );
              const ammQuoteInfo = await this.connection.getAccountInfo(ammQuoteATASell);
              if (ammQuoteInfo && ammQuoteInfo.data.length > 0) {
                const amount = ammQuoteInfo.data.readBigUInt64LE(64);
                poolSolBalance = Number(amount) / 1e9; // Convert to SOL
              }
            } catch (error) {
              console.warn('⚠️ Could not get pool_sol_balance, keeping existing value:', error);
            }
            
            // Update all fields in Supabase
            await LaunchMetadataService.updateMetadata(tokenMintKey.toBase58(), {
              tokens_sold: tokensSoldHuman,
              current_price: currentPrice,
              pool_sol_balance: poolSolBalance
            });
            console.log('✅ Updated launch metadata in Supabase:', {
              tokens_sold: tokensSoldHuman,
              current_price: currentPrice,
              pool_sol_balance: poolSolBalance
            });
          }
        } catch (updateError) {
          console.warn('⚠️ Failed to update launch metadata in Supabase (non-critical):', updateError);
        }
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
    orderId?: string;
  }> {
    let joinDataPda: PublicKey | null = null;
    
    try {
      console.log('🎫 Buying tickets:', { raffleId, userPublicKey, ticketCount, totalCost });
      
      const userPubkey = new PublicKey(userPublicKey);
      
      // The raffleId IS the launch data account (regular account, not PDA)
      const launchDataAccount = new PublicKey(raffleId);
      
      console.log('🔍 Using launch data account:', launchDataAccount.toBase58());
      
      // Fetch launch data to get page_name for JoinData PDA derivation
      const launchAccountInfo = await this.connection.getAccountInfo(launchDataAccount);
      if (!launchAccountInfo) {
        throw new Error('Raffle account not found');
      }
      
      // Parse page_name from launch data (skip account_type and launch_meta)
      let offset = 1; // Skip account_type
      offset += 1; // Skip launch_meta discriminator
      offset += 4; // Skip plugins vector length
      const pageNameLength = Buffer.from(launchAccountInfo.data).readUInt32LE(offset);
      offset += 4;
      const pageName = Buffer.from(launchAccountInfo.data).toString('utf8', offset, offset + pageNameLength);
      console.log('📄 Found page_name:', pageName);
      
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
      
      // Derive JoinData PDA for tracking user purchases
      // Seed: [user_key, page_name, "Joiner"]
      const joinDataPdaResult = PublicKey.findProgramAddressSync(
        [userPubkey.toBuffer(), Buffer.from(pageName), Buffer.from('Joiner')],
        PROGRAM_ID
      );
      joinDataPda = joinDataPdaResult[0];
      
      console.log('🔍 JoinData PDA:', joinDataPda.toBase58());
      
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
          { pubkey: joinDataPda, isSigner: false, isWritable: true },       // accounts[5]: join_data (new)
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      console.log('🔍 Instruction accounts:', {
        user: userPubkey.toBase58(),
        launchData: launchDataAccount.toBase58(),
        userSolAccount: userPubkey.toBase58(),
        ledgerWallet: LEDGER_WALLET.toBase58(),
        systemProgram: SystemProgram.programId.toBase58(),
        joinData: joinDataPda.toBase58()
      });
      
      // Debug: Check if all accounts exist before creating transaction
      console.log('🔍 Checking all accounts before transaction...');
      
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
        const simResult = await this.connection.simulateTransaction(transaction);
        
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
        signature: signature,
        orderId: joinDataPda.toBase58() // Use JoinData PDA as order ID
      };
    } catch (error) {
      console.error('❌ Error buying tickets:', error);
      
      // Check if error is due to already purchased tickets
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('already purchased') || errorMessage.includes('already bought')) {
        return {
          success: false,
          error: `You have already purchased tickets for this raffle. Order ID: ${joinDataPda?.toBase58() || 'Unknown'}`,
          orderId: joinDataPda?.toBase58()
        };
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get user's ticket purchase status for a raffle
   */
  async getUserTicketStatus(
    raffleId: string,
    userPublicKey: string
  ): Promise<{
    hasTickets: boolean;
    orderId?: string;
    numTickets?: number;
    isWinner?: boolean;
    canClaim?: boolean;
    canRefund?: boolean;
  }> {
    try {
      const userPubkey = new PublicKey(userPublicKey);
      const launchDataAccount = new PublicKey(raffleId);
      
      // Fetch launch data to get page_name
      const launchAccountInfo = await this.connection.getAccountInfo(launchDataAccount);
      if (!launchAccountInfo) {
        return { hasTickets: false };
      }
      
      // Parse page_name
      let offset = 1; // Skip account_type
      offset += 1; // Skip launch_meta discriminator
      offset += 4; // Skip plugins vector length
      const pageNameLength = Buffer.from(launchAccountInfo.data).readUInt32LE(offset);
      offset += 4;
      const pageName = Buffer.from(launchAccountInfo.data).toString('utf8', offset, offset + pageNameLength);
      
      // Derive JoinData PDA
      const joinDataPdaResult = PublicKey.findProgramAddressSync(
        [userPubkey.toBuffer(), Buffer.from(pageName), Buffer.from('Joiner')],
        PROGRAM_ID
      );
      const joinDataPda = joinDataPdaResult[0];
      
      // Fetch JoinData account
      const joinAccountInfo = await this.connection.getAccountInfo(joinDataPda);
      if (!joinAccountInfo || joinAccountInfo.data.length === 0) {
        return { hasTickets: false };
      }
      
      // Parse JoinData
      let joinOffset = 1; // Skip account_type
      const joinerKey = new PublicKey(Buffer.from(joinAccountInfo.data.slice(joinOffset, joinOffset + 32)));
      joinOffset += 32;
      
      const joinPageNameLength = Buffer.from(joinAccountInfo.data).readUInt32LE(joinOffset);
      joinOffset += 4;
      const joinPageName = Buffer.from(joinAccountInfo.data).toString('utf8', joinOffset, joinOffset + joinPageNameLength);
      joinOffset += joinPageNameLength;
      
      const numTickets = Buffer.from(joinAccountInfo.data).readUInt16LE(joinOffset);
      joinOffset += 2;
      const numTicketsChecked = Buffer.from(joinAccountInfo.data).readUInt16LE(joinOffset);
      joinOffset += 2;
      const numWinningTickets = Buffer.from(joinAccountInfo.data).readUInt16LE(joinOffset);
      joinOffset += 2;
      
      // Parse ticket_status (enum)
      const ticketStatus = Buffer.from(joinAccountInfo.data).readUInt8(joinOffset);
      
      console.log('🎫 User ticket status:', {
        numTickets,
        numTicketsChecked,
        numWinningTickets,
        ticketStatus
      });
      
      const isWinner = numWinningTickets > 0;
      const canClaim = isWinner && ticketStatus === 0; // TicketStatus::Available
      const canRefund = !isWinner && numTicketsChecked > 0;
      
      return {
        hasTickets: numTickets > 0,
        orderId: joinDataPda.toBase58(),
        numTickets,
        isWinner,
        canClaim,
        canRefund
      };
    } catch (error) {
      console.error('❌ Error fetching user ticket status:', error);
      return { hasTickets: false };
    }
  }

  /**
   * Check tickets to determine winners (call this after raffle ends)
   */
  async checkTickets(
    raffleId: string,
    userPublicKey: string,
    signTransaction: any
  ): Promise<{
    success: boolean;
    signature?: string;
    isWinner?: boolean;
    winningTickets?: number;
    error?: string;
  }> {
    try {
      console.log('🔍 Checking tickets for raffle:', raffleId);
      
      const userPubkey = new PublicKey(userPublicKey);
      const launchDataAccount = new PublicKey(raffleId);
      
      // Fetch launch data to get page_name
      const launchAccountInfo = await this.connection.getAccountInfo(launchDataAccount);
      if (!launchAccountInfo) {
        throw new Error('Raffle account not found');
      }
      
      // Parse page_name
      let offset = 1; // Skip account_type
      offset += 1; // Skip launch_meta discriminator
      offset += 4; // Skip plugins vector length
      const pageNameLength = Buffer.from(launchAccountInfo.data).readUInt32LE(offset);
      offset += 4;
      const pageName = Buffer.from(launchAccountInfo.data).toString('utf8', offset, offset + pageNameLength);
      
      // Derive JoinData PDA
      const joinDataPdaResult = PublicKey.findProgramAddressSync(
        [userPubkey.toBuffer(), Buffer.from(pageName), Buffer.from('Joiner')],
        PROGRAM_ID
      );
      const joinDataPda = joinDataPdaResult[0];
      
      // CheckTickets instruction data (index 3)
      const instructionData = Buffer.from([3]);
      
      // Orao randomness oracle account for devnet
      // This is the VRF program account that provides on-chain randomness
      const ORAO_RANDOM = new PublicKey('VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y');
      
      const transaction = new Transaction();
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPubkey;
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },
          { pubkey: launchDataAccount, isSigner: false, isWritable: true },
          { pubkey: joinDataPda, isSigner: false, isWritable: true },
          { pubkey: ORAO_RANDOM, isSigner: false, isWritable: false }, // Orao randomness oracle
        ],
        programId: PROGRAM_ID,
        data: instructionData,
      });
      
      transaction.add(instruction);
      
      const signature = await signTransaction(transaction);
      console.log('✅ CheckTickets transaction sent:', signature);
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      // Fetch updated JoinData to check if user won
      const updatedJoinInfo = await this.connection.getAccountInfo(joinDataPda);
      if (updatedJoinInfo) {
        let joinOffset = 1; // Skip account_type
        joinOffset += 32; // Skip joiner_key
        const joinPageNameLength = Buffer.from(updatedJoinInfo.data).readUInt32LE(joinOffset);
        joinOffset += 4 + joinPageNameLength;
        const numTickets = Buffer.from(updatedJoinInfo.data).readUInt16LE(joinOffset);
        joinOffset += 2;
        const numTicketsChecked = Buffer.from(updatedJoinInfo.data).readUInt16LE(joinOffset);
        joinOffset += 2;
        const numWinningTickets = Buffer.from(updatedJoinInfo.data).readUInt16LE(joinOffset);
        
        const isWinner = numWinningTickets > 0;
        
        return {
          success: true,
          signature,
          isWinner,
          winningTickets: numWinningTickets
        };
      }
      
      return { success: true, signature };
    } catch (error) {
      console.error('❌ Error checking tickets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check tickets'
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
      const launchDataAccount = new PublicKey(raffleId);
      
      // Fetch launch data to get page_name and baseTokenMint
      const launchAccountInfo = await this.connection.getAccountInfo(launchDataAccount);
      if (!launchAccountInfo) {
        throw new Error('Raffle account not found');
      }
      
      // Parse page_name
      let offset = 1; // Skip account_type
      offset += 1; // Skip launch_meta discriminator
      offset += 4; // Skip plugins vector length
      const pageNameLength = Buffer.from(launchAccountInfo.data).readUInt32LE(offset);
      offset += 4;
      const pageName = Buffer.from(launchAccountInfo.data).toString('utf8', offset, offset + pageNameLength);
      
      // Derive JoinData PDA
      const joinDataPdaResult = PublicKey.findProgramAddressSync(
        [userPubkey.toBuffer(), Buffer.from(pageName), Buffer.from('Joiner')],
        PROGRAM_ID
      );
      const joinDataPda = joinDataPdaResult[0];
      
      // Parse baseTokenMint from keys array (offset starts after strings)
      // For now, try to get it from the RaffleData
      let baseTokenMint: PublicKey;
      try {
        // Try to get from the account structure - approximate location
        const keysOffset = offset + pageNameLength + 200; // Approximate
        const mintBytes = Buffer.from(launchAccountInfo.data.slice(keysOffset, keysOffset + 32));
        baseTokenMint = new PublicKey(mintBytes);
      } catch {
        // Fallback: use a placeholder
        baseTokenMint = launchDataAccount;
      }
      
      // Check if this is a Token 2022 mint
      const mintAccountInfo = await this.throttledRequest(() => this.connection.getAccountInfo(baseTokenMint));
      const isToken2022 = mintAccountInfo?.owner.toBase58() === TOKEN_2022_PROGRAM_ID.toBase58();
      const tokenProgram = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      
      // Get the user's Associated Token Account for this token mint
      const userTokenAccount = await getAssociatedTokenAddress(baseTokenMint, userPubkey);
      
      console.log('🎯 Claim tokens details:', {
        raffleId: raffleId,
        tokenMint: baseTokenMint.toBase58(),
        userTokenAccount: userTokenAccount.toBase58(),
        user: userPubkey.toBase58(),
        joinData: joinDataPda.toBase58()
      });
      
      // Create instruction data for ClaimTokens (no args needed)
      const instructionData = Buffer.from([8]); // ClaimTokens variant index
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },        // user
          { pubkey: launchDataAccount, isSigner: false, isWritable: true },     // launch_data
          { pubkey: userTokenAccount, isSigner: false, isWritable: true }, // user_token_account
          { pubkey: baseTokenMint, isSigner: false, isWritable: true },        // token_mint
          { pubkey: tokenProgram, isSigner: false, isWritable: false }, // token_program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
          { pubkey: joinDataPda, isSigner: false, isWritable: true }, // join_data (new)
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
      const launchDataAccount = new PublicKey(raffleId);
      
      // Fetch launch data to get page_name
      const launchAccountInfo = await this.connection.getAccountInfo(launchDataAccount);
      if (!launchAccountInfo) {
        throw new Error('Raffle account not found');
      }
      
      // Parse page_name
      let offset = 1; // Skip account_type
      offset += 1; // Skip launch_meta discriminator
      offset += 4; // Skip plugins vector length
      const pageNameLength = Buffer.from(launchAccountInfo.data).readUInt32LE(offset);
      offset += 4;
      const pageName = Buffer.from(launchAccountInfo.data).toString('utf8', offset, offset + pageNameLength);
      
      // Derive JoinData PDA
      const joinDataPdaResult = PublicKey.findProgramAddressSync(
        [userPubkey.toBuffer(), Buffer.from(pageName), Buffer.from('Joiner')],
        PROGRAM_ID
      );
      const joinDataPda = joinDataPdaResult[0];
      
      console.log('🔍 Claim refund details:', {
        raffleId: raffleId,
        user: userPubkey.toBase58(),
        joinData: joinDataPda.toBase58()
      });
      
      // Create instruction data for ClaimRefund (no args needed)
      const instructionData = Buffer.from([6]); // ClaimRefund variant index
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },        // user
          { pubkey: launchDataAccount, isSigner: false, isWritable: true },     // launch_data
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
          { pubkey: joinDataPda, isSigner: false, isWritable: true }, // join_data (new)
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

  /**
   * Get available tokens from all launches (with caching)
   */
  async getAvailableTokens(forceRefresh: boolean = false): Promise<TokenInfo[]> {
    // Import tradeCache once at the top
    const { tradeCache } = await import('./tradeCache');
    
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = tradeCache.getTokens();
        if (cached) {
          console.log('📦 Using cached token data');
          return cached;
        }
      }
      
      const { launchDataService } = await import('./launchDataService');
      
      // Get cached launch IDs to check for new launches only
      const cachedLaunchIds = tradeCache.getLaunchIds();
      let launches;
      
      if (cachedLaunchIds && !forceRefresh) {
        // Only fetch new launches
        console.log('🔄 Checking for new launches only...');
        const allLaunches = await launchDataService.getAllLaunches();
        const allLaunchIds = allLaunches.map(l => l.id);
        const newLaunchIds = tradeCache.updateLaunchCache(allLaunchIds);
        
        if (newLaunchIds.length === 0) {
          // No new launches, use cached tokens
          const cached = tradeCache.getTokens();
          if (cached) {
            console.log('✅ No new launches, using cached tokens');
            return cached;
          }
        } else {
          console.log(`🆕 Found ${newLaunchIds.length} new launches`);
          // Only process new launches and merge with cached
          launches = allLaunches;
        }
      } else {
        // First load or force refresh - fetch all
        console.log('🔄 Fetching all launches...');
        launches = await launchDataService.getAllLaunches();
        const allLaunchIds = launches.map(l => l.id);
        tradeCache.updateLaunchCache(allLaunchIds);
      }
      
      // Filter for instant launches (tradable tokens)
      const instantLaunches = (launches || []).filter(launch => launch.launchType === 'instant');
      
      const tokens: (TokenInfo | null)[] = await Promise.all(
        instantLaunches.map(async (launch) => {
          try {
            const tokenMint = new PublicKey(launch.baseTokenMint || launch.id);
            
            // Get token metadata
            const symbol = launch.rawMetadata?.tokenSymbol || launch.symbol || 'UNKNOWN';
            const name = launch.rawMetadata?.tokenName || launch.name || 'Unknown Token';
            
            // Get market data (price, volume, etc.)
            let price = launch.initialPrice || 0.01;
            let change24h = 0;
            let volume24h = 0;
            let liquidity = 0;
            
            try {
              const { marketDataService } = await import('./marketDataService');
              const marketData = await marketDataService.getMarketData(
                tokenMint.toBase58(),
                launch.totalSupply
              );
              price = marketData.price || price;
              change24h = (marketData as any).change24h || 0;
              volume24h = marketData.volume24h || 0;
              liquidity = marketData.liquidity || 0;
            } catch (error) {
              console.warn('Could not fetch market data for token:', error);
            }
            
            return {
              symbol,
              name,
              mint: tokenMint,
              price,
              change24h,
              volume24h,
              holders: launch.participants || 0,
              upvotes: 0, // Would need separate voting system
              downvotes: 0,
              liquidity,
              marketCap: price * (launch.totalSupply || 0),
              decimals: launch.decimals || 9,
              dexProvider: launch.dexProvider === 1 ? 'raydium' : 'cook'
            };
          } catch (error) {
            console.error('Error processing launch token:', error);
            return null;
          }
        })
      );
      
      const filteredTokens = tokens.filter((token): token is TokenInfo => token !== null);
      
      // Cache the results
      tradeCache.setTokens(filteredTokens);
      
      return filteredTokens;
    } catch (error) {
      console.error('Error fetching available tokens:', error);
      // Return cached data if available
      const cached = tradeCache.getTokens();
      if (cached) {
        console.log('⚠️ Error fetching tokens, using cached data');
        return cached;
      }
      return [];
    }
  }

  /**
   * Get user balances for all tokens (with caching)
   */
  async getUserBalances(userPublicKey: PublicKey, forceRefresh: boolean = false): Promise<{ [key: string]: number }> {
    // Import tradeCache once at the top
    const { tradeCache } = await import('./tradeCache');
    
    try {
      const userKey = userPublicKey.toBase58();
      
      // Check cache first
      if (!forceRefresh) {
        const cached = tradeCache.getBalance(userKey);
        if (cached) {
          console.log('📦 Using cached balance data');
          return cached;
        }
      }
      
      const balances: { [key: string]: number } = {};
      
      // Get SOL balance (store as both 'sol' and 'SOL' for compatibility)
      const solBalance = await this.connection.getBalance(userPublicKey);
      const solBalanceSOL = solBalance / LAMPORTS_PER_SOL;
      balances['sol'] = solBalanceSOL;
      balances['SOL'] = solBalanceSOL; // Also store uppercase for display
      
      // Get token balances
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        userPublicKey,
        { programId: TOKEN_PROGRAM_ID },
        'confirmed'
      );
      
      for (const account of tokenAccounts.value) {
        try {
          if (!account.account || typeof account.account.data !== 'object' || !('parsed' in account.account.data)) {
            continue;
          }
          const parsed = account.account.data.parsed as any;
          if (!parsed.info) {
            continue;
          }
          const mint = parsed.info.mint;
          const amount = parsed.info.tokenAmount?.amount || '0';
          const decimals = parsed.info.tokenAmount?.decimals || 9;
          const balance = Number(amount) / Math.pow(10, decimals);
          
          // Get token symbol from launches
          const { launchDataService } = await import('./launchDataService');
          const launch = await launchDataService.getLaunchByTokenMint(mint);
          
          if (launch) {
            const symbol = (launch.rawMetadata?.tokenSymbol || launch.symbol || 'TOKEN').toLowerCase();
            balances[symbol] = balance;
          }
        } catch (error) {
          // Skip invalid accounts
          continue;
        }
      }
      
      // Cache the results
      tradeCache.setBalance(userKey, balances);
      
      return balances;
    } catch (error) {
      console.error('Error fetching user balances:', error);
      // Return cached data if available
      const cached = tradeCache.getBalance(userPublicKey.toBase58());
      if (cached) {
        console.log('⚠️ Error fetching balances, using cached data');
        return cached;
      }
      return {};
    }
  }

  /**
   * Get user liquidity positions
   */
  async getUserLiquidityPositions(userPublicKey: PublicKey): Promise<LiquidityPosition[]> {
    try {
      const { liquidityService } = await import('./liquidityService');
      const positions = await liquidityService.getUserLiquidityPositions(userPublicKey);
      
      return positions.map(pos => ({
        tokenSymbol: pos.tokenA,
        tokenName: pos.tokenA,
        lpTokens: pos.liquidity,
        value: pos.value,
        apy: 12.5, // Would calculate from pool data
        feesEarned: pos.feesEarned
      }));
    } catch (error) {
      console.error('Error fetching user liquidity positions:', error);
      return [];
    }
  }

  /**
   * Get market making rewards
   */
  async getMarketMakingRewards(userPublicKey: PublicKey): Promise<MarketMakingReward[]> {
    try {
      // This would query your program for market making rewards
      // For now, return empty array as rewards system needs to be implemented
      return [];
    } catch (error) {
      console.error('Error fetching market making rewards:', error);
      return [];
    }
  }

  /**
   * Add liquidity to Cook DEX pool
   */
  async addLiquidityCookDEX(
    tokenMint: PublicKey,
    solAmount: number,
    tokenAmount: number,
    userPublicKey: PublicKey,
    signTransaction: (transaction: Transaction) => Promise<Transaction>
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> {
    try {
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const { realLaunchService } = await import('./realLaunchService');
      
      // Build transaction
      const transaction = await realLaunchService.buildAddLiquidityTransaction(
        tokenMint,
        WSOL_MINT,
        tokenAmount,
        solAmount,
        userPublicKey
      );
      
      // Get fresh blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = userPublicKey;
      
      // Sign and send
      const signedTransaction = await signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      return {
        success: true,
        signature
      };
    } catch (error) {
      console.error('Error adding liquidity to Cook DEX:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add liquidity'
      };
    }
  }

  /**
   * Build CreateRaydium instruction for atomic pool creation
   * This is called when graduation threshold (30 SOL) will be met
   */
  private async buildCreateRaydiumInstruction(
    user: PublicKey,
    tokenMint: PublicKey,
    ammAccount: PublicKey,
    totalSupply: number
  ): Promise<TransactionInstruction | null> {
    try {
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const RAYDIUM_AMM_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
      
      // Get AMM account balance to calculate liquidity amounts
      const ammAccountInfo = await this.connection.getAccountInfo(ammAccount);
      const solInAmm = ammAccountInfo?.lamports || 0;
      
      // Use 50% of SOL in AMM for liquidity (as per graduation logic)
      const liquiditySolAmount = Math.floor(solInAmm / 2);
      const liquidityTokenAmount = Math.floor((totalSupply * 1e9) / 2); // 50% of total supply
      
      console.log('💰 Creating Raydium pool with:', {
        solAmount: liquiditySolAmount / 1e9,
        tokenAmount: liquidityTokenAmount / 1e9,
        totalSupply: totalSupply
      });
      
      // Derive Raydium pool PDA (pool_state)
      // Raydium uses: [b"amm_associated_seed", base_mint, quote_mint]
      const baseFirst = tokenMint.toBase58() < WSOL_MINT.toBase58();
      const [baseMint, quoteMint] = baseFirst 
        ? [tokenMint, WSOL_MINT]
        : [WSOL_MINT, tokenMint];
      
      const [poolState] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('amm_associated_seed'),
          baseMint.toBuffer(),
          quoteMint.toBuffer(),
        ],
        RAYDIUM_AMM_V4
      );
      
      // Try to get pool info to extract other accounts
      // If pool doesn't exist yet, we'll need to create it first
      // For now, we'll use placeholder accounts that the backend can handle
      // The backend CreateRaydium instruction will handle the actual pool creation via CPI
      
      // Note: For a new pool, these accounts need to be created/derived by Raydium
      // The backend's CreateRaydium instruction handles this via CPI to Raydium
      // We just need to pass the pool_state PDA and mints
      
      // For now, use pool_state as placeholder for other accounts
      // The backend will derive/create them via Raydium CPI
      const poolAuthority = poolState; // Placeholder - backend will derive
      const poolTokenVaultA = poolState; // Placeholder - backend will derive
      const poolTokenVaultB = poolState; // Placeholder - backend will derive
      const lpMint = poolState; // Placeholder - backend will derive
      
      // Import LetsCookProgram
      const { LetsCookProgram } = await import('./nativeProgram');
      
      // Build instruction
      const instruction = LetsCookProgram.createRaydiumPoolInstruction(
        {
          amount_0: liquiditySolAmount,
          amount_1: liquidityTokenAmount,
        },
        {
          user,
          tokenMintA: baseMint,
          tokenMintB: quoteMint,
          poolState,
          poolAuthority,
          poolTokenVaultA,
          poolTokenVaultB,
          lpMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }
      );
      
      console.log('✅ CreateRaydium instruction built successfully');
      return instruction;
    } catch (error) {
      console.error('❌ Error building CreateRaydium instruction:', error);
      return null;
    }
  }
}

// Export interfaces
export interface TokenInfo {
  symbol: string;
  name: string;
  mint: PublicKey;
  price: number;
  change24h: number;
  volume24h: number;
  holders: number;
  upvotes: number;
  downvotes: number;
  liquidity: number;
  marketCap: number;
  decimals: number;
  dexProvider: 'cook' | 'raydium';
}

export interface LiquidityPosition {
  tokenSymbol: string;
  tokenName: string;
  lpTokens: number;
  value: number;
  apy: number;
  feesEarned: number;
}

export interface MarketMakingReward {
  tokenSymbol: string;
  tokenName: string;
  rewardAmount: number;
  rewardToken: string;
  launchDate: string;
  claimed: boolean;
}

// Export a default instance
export const tradingService = new TradingService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);