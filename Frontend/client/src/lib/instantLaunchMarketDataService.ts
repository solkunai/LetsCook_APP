import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from './nativeProgram';

export interface InstantLaunchMarketData {
  price: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
  circulatingSupply: number;
  totalSupply: number;
  lastUpdated: number;
}

export class InstantLaunchMarketDataService {
  private connection: Connection;
  private cache = new Map<string, { data: InstantLaunchMarketData; timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get real market data for instant launch tokens
   */
  async getMarketData(launchDataAccount: string, tokenMint: string): Promise<InstantLaunchMarketData> {
    // Use tokenMint as primary cache key (more reliable than launchDataAccount)
    const cacheKey = tokenMint;
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const { blockchainIntegrationService } = await import('./blockchainIntegrationService');
      // Try to get launch data by token mint first, then by account address
      let cachedLaunchData = await blockchainIntegrationService.getLaunchByAddress(launchDataAccount);
      
      // If not found, try searching by token mint
      if (!cachedLaunchData) {
        const allLaunches = await blockchainIntegrationService.getAllLaunches();
        cachedLaunchData = allLaunches.find(l => l.baseTokenMint === tokenMint) || null;
      }
      
      if (!cachedLaunchData) {
        throw new Error('Launch data not found in cache');
      }

      // Use the actual token mint from launch data, not the parameter (which might be wrong)
      const actualTokenMint = cachedLaunchData.baseTokenMint || tokenMint;
      const ammData = await this.getAMMAccountData(actualTokenMint);
      if (!ammData) {
        // AMM account not found or network error while fetching data.
        // Cache a zeroed response so we don't keep hammering the RPC endpoint.
        console.log('AMM account not found for instant launch:', actualTokenMint, '- Pool not initialized yet or RPC unavailable');
        const fallbackData: InstantLaunchMarketData = {
          price: 0,
          marketCap: 0,
          liquidity: 0, // Zero liquidity when pool not initialized
          volume24h: 0,
          priceChange24h: 0,
          circulatingSupply: 0,
          totalSupply: cachedLaunchData.totalSupply || 0,
          lastUpdated: Date.now()
        };
        this.cache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
        return fallbackData;
      }
      
      // Log AMM data for debugging
      console.log('📊 Instant Launch AMM Data:', {
        tokenMint: actualTokenMint,
        solReserves: ammData.solReserves,
        tokenReserves: ammData.tokenReserves,
        price: ammData.price,
        calculatedLiquidity: ammData.solReserves * 2
      });
      
      // Get token price using Pyth Network (with fallback to pool reserves)
      const { pythPriceService } = await import('./pythPriceService');
      const tokenPrice = await pythPriceService.getTokenPrice(
        actualTokenMint,
        ammData.solReserves,
        ammData.tokenReserves
      );
      
      // Use Pyth price if available, otherwise use AMM price
      const realPrice = tokenPrice > 0 ? tokenPrice : ammData.price;
      
      // Liquidity = total SOL in pool (quote reserves * 2 for 50/50 pool)
      const realLiquidity = ammData.solReserves * 2;
      
      // Calculate circulating supply: total supply - tokens in AMM pool
      const circulatingSupply = Math.max(0, cachedLaunchData.totalSupply - ammData.tokenReserves);
      
      // Market cap = circulating_supply * token_price
      const realMarketCap = circulatingSupply * realPrice;
      // Get real 24h volume from transactions
      const { marketDataService } = await import('./marketDataService');
      const volume24h = await marketDataService.getTradingVolume24h(tokenMint);
      const priceChange24h = 0;
      
      const marketData: InstantLaunchMarketData = {
        price: realPrice,
        marketCap: realMarketCap,
        liquidity: realLiquidity,
        volume24h: volume24h / 1e9,
        priceChange24h,
        circulatingSupply,
        totalSupply: cachedLaunchData.totalSupply,
        lastUpdated: Date.now()
      };
      
      this.cache.set(cacheKey, { data: marketData, timestamp: Date.now() });
      return marketData;
      
    } catch (error) {
      
      // Return zero data when error occurs
      const zeroData: InstantLaunchMarketData = {
        price: 0,
        marketCap: 0,
        liquidity: 0,
        volume24h: 0,
        priceChange24h: 0,
        circulatingSupply: 0,
        totalSupply: 0,
        lastUpdated: Date.now()
      };
      this.cache.set(cacheKey, { data: zeroData, timestamp: Date.now() });
      return zeroData;
    }
  }

  /**
   * Parse launch data account to extract relevant fields
   */
  private parseLaunchData(data: Buffer): {
    totalSupply: number;
    numMints: number;
    ticketsSold: number;
    ticketPrice: number;
  } {
    try {
      console.log('📊 Parsing launch data from account...');
      console.log('📊 Account data length:', data.length, 'bytes');
      
      // Return zero values when data cannot be parsed
      console.log('⚠️ Using zero default values - data could not be parsed');
      
      const safeDefaults = {
        totalSupply: 0,
        numMints: 0,
        ticketsSold: 0,
        ticketPrice: 0
      };
      
      console.log('⚠️ Using zero launch data defaults:', safeDefaults);
      return safeDefaults;
      
    } catch (error) {
      console.warn('Error parsing launch data, using zero defaults:', error);
      return {
        totalSupply: 0,
        numMints: 0,
        ticketsSold: 0,
        ticketPrice: 0
      };
    }
  }

  /**
   * Get AMM account data for price calculation (real implementation)
   */
  private async getAMMAccountData(tokenMint: string): Promise<{
    solReserves: number;
    tokenReserves: number;
    price: number;
  } | null> {
    try {
      const { getAccount } = await import('@solana/spl-token');
      const tokenMintKey = new PublicKey(tokenMint);
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      
      // Use correct AMM PDA derivation matching backend: [baseMint, quoteMint, "CookAMM"] (sorted)
      // Backend code: instant_launch.rs uses get_amm_pda which sorts mints
      const baseFirst = tokenMintKey.toString() < WSOL_MINT.toString();
      const ammSeeds = baseFirst
        ? [tokenMintKey.toBuffer(), WSOL_MINT.toBuffer(), Buffer.from('CookAMM')]
        : [WSOL_MINT.toBuffer(), tokenMintKey.toBuffer(), Buffer.from('CookAMM')];
      
      const [ammAccount] = PublicKey.findProgramAddressSync(ammSeeds, PROGRAM_ID);
      
      const accountInfo = await this.connection.getAccountInfo(ammAccount);
      if (!accountInfo || accountInfo.data.length === 0) {
        return null;
      }
      
      // Parse AMM account data structure (same as marketDataService)
      const data = accountInfo.data;
      const dataLength = data.length;
      let offset = 0;
      
      // Minimum required size check - be more lenient for smaller accounts
      // AMM accounts can vary in size depending on initialization state
      // 88 bytes might be a partially initialized account, so try to parse what we can
      const MIN_REQUIRED_SIZE = 80; // Reduced from 232 to handle partially initialized accounts
      if (dataLength < MIN_REQUIRED_SIZE) {
        console.warn(`AMM account data too small: ${dataLength} bytes, falling back to token accounts`);
        return await this.getAMMDataFromTokenAccounts(tokenMint);
      }
      
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
      
      // Skip lp_mint (32 bytes)
      offset += 32;
      
      // base_key (32 bytes) - token account for base token
      if (offset + 32 > dataLength) {
        console.warn('Buffer too small for base_key');
        return await this.getAMMDataFromTokenAccounts(tokenMint);
      }
      const baseKey = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      // quote_key (32 bytes) - token account for quote token (SOL/WSOL)
      if (offset + 32 > dataLength) {
        console.warn('Buffer too small for quote_key');
        return await this.getAMMDataFromTokenAccounts(tokenMint);
      }
      const quoteKey = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      // Skip fee (4 bytes)
      offset += 4;
      
      // Skip numDataAccounts (4 bytes)
      offset += 4;
      
      // lastPrice (8 bytes) - double
      if (offset + 8 > dataLength) {
        console.warn('Buffer too small for lastPrice');
        return await this.getAMMDataFromTokenAccounts(tokenMint);
      }
      const lastPrice = data.readDoubleLE(offset);
      offset += 8;
      
      // Skip lpAmount (8 bytes)
      offset += 8;
      
      // Skip borrowCost (8 bytes)
      offset += 8;
      
      // Skip leverageFrac (8 bytes)
      offset += 8;
      
      // ammBaseAmount (8 bytes) - base token reserves in AMM
      if (offset + 8 > dataLength) {
        console.warn('Buffer too small for ammBaseAmount');
        return await this.getAMMDataFromTokenAccounts(tokenMint);
      }
      const ammBaseAmount = data.readBigUInt64LE(offset);
      offset += 8;
      
      // ammQuoteAmount (8 bytes) - quote token reserves in AMM
      if (offset + 8 > dataLength) {
        console.warn('Buffer too small for ammQuoteAmount');
        return await this.getAMMDataFromTokenAccounts(tokenMint);
      }
      const ammQuoteAmount = data.readBigUInt64LE(offset);
      offset += 8;
      
      // Get actual token account balances
      let solReserves = 0;
      let tokenReserves = 0;
      
      try {
        // Get quote token account (WSOL) balance
        const quoteAccountInfo = await getAccount(this.connection, quoteKey);
        solReserves = Number(quoteAccountInfo.amount) / 1e9; // WSOL has 9 decimals
        
        // Get base token account balance
        const baseAccountInfo = await getAccount(this.connection, baseKey);
        // Get decimals from the mint account, not the token account
        const { getMint, TOKEN_2022_PROGRAM_ID } = await import('@solana/spl-token');
        const mintInfo = await getMint(this.connection, tokenMintKey, 'confirmed', TOKEN_2022_PROGRAM_ID).catch(() => 
          getMint(this.connection, tokenMintKey, 'confirmed')
        );
        tokenReserves = Number(baseAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
      } catch (error) {
        console.warn('Could not fetch token account balances, using AMM account data:', error);
        // Fallback to AMM account data
        solReserves = Number(ammQuoteAmount) / 1e9;
        tokenReserves = Number(ammBaseAmount) / 1e9; // Assuming 9 decimals for base token
      }
      
      // Calculate price: quote per base (SOL per token)
      const price = tokenReserves > 0 ? solReserves / tokenReserves : (lastPrice > 0 ? lastPrice : 0);
      
      return {
        solReserves,
        tokenReserves,
        price: price || lastPrice || 0
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isNetworkError = message.includes('Failed to fetch') || message.includes('ERR_TOO_MANY_RETRIES');
      console.error('Error parsing AMM account data:', error);
      if (isNetworkError) {
        // Don't trigger the fallback when the RPC node is already overloaded.
        return null;
      }
      // Fallback: try to get data from token accounts directly
      return await this.getAMMDataFromTokenAccounts(tokenMint);
    }
  }

  // Fallback method: Get AMM data from token accounts when account structure is unknown
  private async getAMMDataFromTokenAccounts(tokenMint: string): Promise<{
    solReserves: number;
    tokenReserves: number;
    price: number;
  } | null> {
    try {
      const { getAccount, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const tokenMintKey = new PublicKey(tokenMint);
      
      // Use correct AMM PDA derivation matching backend: [baseMint, quoteMint, "CookAMM"] (sorted)
      const baseFirst = tokenMintKey.toString() < WSOL_MINT.toString();
      const ammSeeds = baseFirst
        ? [tokenMintKey.toBuffer(), WSOL_MINT.toBuffer(), Buffer.from('CookAMM')]
        : [WSOL_MINT.toBuffer(), tokenMintKey.toBuffer(), Buffer.from('CookAMM')];
      
      const [ammAccount] = PublicKey.findProgramAddressSync(ammSeeds, PROGRAM_ID);
      
      // Try to find token accounts associated with the AMM
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        ammAccount,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      let solReserves = 0;
      let tokenReserves = 0;
      
      for (const account of tokenAccounts.value) {
        try {
          const accountInfo = await getAccount(this.connection, account.pubkey);
          const mint = accountInfo.mint.toBase58();
          
          if (mint === WSOL_MINT.toBase58()) {
            solReserves = Number(accountInfo.amount) / 1e9;
          } else if (mint === tokenMint) {
            // Get decimals from mint account
            const { getMint, TOKEN_2022_PROGRAM_ID } = await import('@solana/spl-token');
            const mintInfo = await getMint(this.connection, tokenMintKey, 'confirmed', TOKEN_2022_PROGRAM_ID).catch(() => 
              getMint(this.connection, tokenMintKey, 'confirmed')
            );
            tokenReserves = Number(accountInfo.amount) / Math.pow(10, mintInfo.decimals);
          }
        } catch (error) {
          continue;
        }
      }
      
      if (solReserves === 0 && tokenReserves === 0) {
        return null;
      }
      
      // Calculate price
      const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;
      
      return {
        solReserves,
        tokenReserves,
        price
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isNetworkError = message.includes('Failed to fetch') || message.includes('ERR_TOO_MANY_RETRIES');
      if (!isNetworkError) {
        console.error('Error getting AMM data from token accounts:', error);
      }
      return null;
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}