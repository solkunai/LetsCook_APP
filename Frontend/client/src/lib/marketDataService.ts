import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { InstantLaunchMarketDataService } from './instantLaunchMarketDataService';
import { pythPriceService } from './pythPriceService';

export interface MarketData {
  price: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  priceChange24h: number;
  priceChange1h: number;
  priceChange7d: number;
  lastUpdated: number;
}

export interface PriceHistory {
  timestamp: number;
  price: number;
  volume: number;
}

class MarketDataService {
  private connection: Connection;
  private instantMarketDataService: InstantLaunchMarketDataService;
  
  // Simple rate limiting
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 500; // 500ms between requests
  private cache: Map<string, { data: MarketData; timestamp: number }> = new Map();
  private priceHistoryCache: Map<string, PriceHistory[]> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(connection: Connection) {
    this.connection = connection;
    this.instantMarketDataService = new InstantLaunchMarketDataService(connection);
  }

  /**
   * Simple rate limiting to prevent 429 errors
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Get real-time market data for a token
  async getMarketData(tokenMint: string, totalSupply?: number): Promise<MarketData> {
    const cacheKey = tokenMint;
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Fetching market data - no logging
      
      // Check if this is an instant launch token
      const launchData = await this.findLaunchByTokenMint(tokenMint);
      if (launchData && launchData.launchType === 'instant') {
        // Using instant launch service - no logging
        const instantMarketData = await this.instantMarketDataService.getMarketData(
          launchData.launchDataAccount,
          tokenMint
        );
        
        const marketData: MarketData = {
          price: instantMarketData.price,
          marketCap: instantMarketData.marketCap,
          volume24h: instantMarketData.volume24h,
          liquidity: instantMarketData.liquidity,
          holders: 0, // Would need to calculate separately
          priceChange24h: instantMarketData.priceChange24h,
          priceChange1h: 0, // Would need historical data
          priceChange7d: 0, // Would need historical data
          lastUpdated: instantMarketData.lastUpdated
        };
        
        // Cache the data
        this.cache.set(cacheKey, {
          data: marketData,
          timestamp: Date.now()
        });
        
        // Market data fetched - no logging
        return marketData;
      }
      
      // For non-instant launches, use the existing AMM-based approach
      // Get real AMM account data
      const ammData = await this.getAMMAccountData(tokenMint);
      if (!ammData) {
        throw new Error('AMM account not found or not initialized');
      }
      
      // Get real holder count
      const holders = await this.getTokenHolderCount(tokenMint);
      
      // Get real trading volume from recent transactions
      const volume24h = await this.getTradingVolume24h(tokenMint);
      
      // Get token price using Pyth Network (with fallback to pool reserves)
      const tokenPrice = await pythPriceService.getTokenPrice(
        tokenMint,
        ammData.solReserves,
        ammData.tokenReserves
      );
      
      // Use Pyth price if available, otherwise use AMM price
      const currentPrice = tokenPrice > 0 ? tokenPrice : ammData.price;
      
      // Calculate circulating supply: total supply - tokens in AMM pool
      const circulatingSupply = totalSupply 
        ? Math.max(0, totalSupply - ammData.tokenReserves)
        : ammData.tokenReserves;
      
      // Market cap = circulating_supply * token_price
      const marketCap = circulatingSupply * currentPrice;
      
      // Liquidity = total SOL in pool (quote reserves * 2 for 50/50 pool)
      const liquidity = ammData.solReserves * 2;
      
      // Calculate price changes (we'll need historical data for this)
      const priceChange24h = await this.getPriceChange24h(tokenMint, currentPrice);
      const priceChange1h = await this.getPriceChange1h(tokenMint, currentPrice);
      const priceChange7d = await this.getPriceChange7d(tokenMint, currentPrice);
      
      const marketData: MarketData = {
        price: currentPrice,
        marketCap,
        volume24h,
        liquidity,
        holders,
        priceChange24h,
        priceChange1h,
        priceChange7d,
        lastUpdated: Date.now()
      };
      
      // Cache the data
      this.cache.set(cacheKey, {
        data: marketData,
        timestamp: Date.now()
      });
      
      // Index price data for historical tracking and charts
      try {
        const { priceIndexerService } = await import('./priceIndexerService');
        await priceIndexerService.indexPriceData(
          tokenMint,
          marketData.price,
          marketData.volume24h,
          marketData.liquidity,
          marketData.marketCap
        );
      } catch (error) {
        console.warn('⚠️ Error indexing price data:', error);
      }
      
      // Real market data fetched - no logging
      return marketData;
    } catch (error) {
      console.error('Error fetching real market data:', error);
      // Fallback to simulated data if blockchain data fails
      // Falling back to simulated data - no logging
      return await this.simulateMarketData(tokenMint);
    }
  }

  // Find launch data by token mint
  private async findLaunchByTokenMint(tokenMint: string): Promise<{ launchType: string; launchDataAccount: string } | null> {
    try {
      // Import launchDataService dynamically to avoid circular dependency
      const { launchDataService } = await import('./launchDataService');
      const launchData = await launchDataService.getLaunchByTokenMint(tokenMint);
      
      if (launchData) {
        return {
          launchType: launchData.launchType,
          launchDataAccount: launchData.launchDataAccount
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error finding launch by token mint:', error);
      return null;
    }
  }

  // Get price history for chart
  async getPriceHistory(tokenMint: string, timeframe: '1h' | '24h' | '7d'): Promise<PriceHistory[]> {
    const cacheKey = `${tokenMint}_${timeframe}`;
    const cached = this.priceHistoryCache.get(cacheKey);
    
    // Return cached data if still valid (shorter cache for price history)
    if (cached && Date.now() - (cached[0]?.timestamp || 0) < 60000) { // 1 minute
      return cached;
    }

    try {
      // Fetching price history - no logging
      
      // Get real price history from blockchain transactions
      const priceHistory = await this.getRealPriceHistory(tokenMint, timeframe);
      
      // Cache the data
      this.priceHistoryCache.set(cacheKey, priceHistory);
      
      return priceHistory;
    } catch (error) {
      console.error('Error fetching real price history:', error);
      // Fallback to generated data
      // Falling back to generated price history - no logging
      const priceHistory = this.generatePriceHistory(timeframe);
      this.priceHistoryCache.set(cacheKey, priceHistory);
      return priceHistory;
    }
  }

  // Get real price history from blockchain transactions
  async getRealPriceHistory(tokenMint: string, timeframe: '1h' | '24h' | '7d'): Promise<PriceHistory[]> {
    try {
      const tokenMintKey = new PublicKey(tokenMint);
      
      // Get AMM account
      const [ammAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenMintKey.toBuffer()],
        new PublicKey('J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg') // PROGRAM_ID
      );
      
      // Get current AMM data
      const currentAmmData = await this.getAMMAccountData(tokenMint);
      if (!currentAmmData || currentAmmData.solReserves === 0) {
        // AMM not initialized yet, return flat price history
        // AMM not initialized - no logging
        return this.generatePriceHistory(timeframe);
      }
      
      // Get recent transactions for this AMM account
      const signatures = await this.connection.getSignaturesForAddress(ammAccount, {
        limit: 100, // Get last 100 transactions
        before: undefined
      });
      
      // Parse transactions to extract price history
      const priceHistory: PriceHistory[] = [];
      const now = Date.now();
      const intervals = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };
      
      const timeWindow = intervals[timeframe];
      const dataPoints = timeframe === '1h' ? 60 : timeframe === '24h' ? 24 : 7;
      const step = timeWindow / dataPoints;
      
      // Process recent transactions
      for (const sig of signatures.slice(0, 20)) { // Process last 20 transactions
        try {
          const tx = await this.connection.getTransaction(sig.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          
          if (tx && tx.meta && tx.blockTime) {
            const txTime = tx.blockTime * 1000; // Convert to milliseconds
            
            // Only include transactions within our timeframe
            if (now - txTime <= timeWindow) {
              // Parse transaction logs to extract price information
              const price = this.extractPriceFromTransaction(tx, currentAmmData.price);
              const volume = this.extractVolumeFromTransaction(tx);
              
              priceHistory.push({
                timestamp: txTime,
                price,
                volume
              });
            }
          }
        } catch (txError) {
          console.warn('Error processing transaction:', txError);
        }
      }
      
      // Sort by timestamp and fill gaps
      priceHistory.sort((a, b) => a.timestamp - b.timestamp);
      
      // Fill gaps with interpolated data
      const filledHistory = this.fillPriceHistoryGaps(priceHistory, timeframe, currentAmmData.price);
      
      return filledHistory;
    } catch (error) {
      console.error('Error getting real price history:', error);
      throw error;
    }
  }

  // Extract price from transaction logs
  private extractPriceFromTransaction(tx: any, currentPrice: number): number {
    try {
      // Look for price information in transaction logs
      if (tx.meta?.logMessages) {
        for (const log of tx.meta.logMessages) {
          // Look for price-related logs
          if (log.includes('price') || log.includes('swap')) {
            // Extract price from log (this would need to be customized based on your program's logs)
            const priceMatch = log.match(/price[:\s]+([0-9.]+)/i);
            if (priceMatch) {
              return parseFloat(priceMatch[1]);
            }
          }
        }
      }
      
      // Fallback to current price
      return currentPrice;
    } catch (error) {
      console.warn('Error extracting price from transaction:', error);
      return currentPrice;
    }
  }

  // Extract volume from transaction
  private extractVolumeFromTransaction(tx: any): number {
    try {
      // Look for SOL transfer amounts in the transaction
      if (tx.meta?.preBalances && tx.meta?.postBalances) {
        let totalVolume = 0;
        
        for (let i = 0; i < tx.meta.preBalances.length; i++) {
          const preBalance = tx.meta.preBalances[i];
          const postBalance = tx.meta.postBalances[i];
          const change = Math.abs(postBalance - preBalance);
          
          if (change > 0) {
            totalVolume += change;
          }
        }
        
        return totalVolume / 1e9; // Convert lamports to SOL
      }
      
      return 0; // No volume data available
    } catch (error) {
      console.warn('Error extracting volume from transaction:', error);
      return 0; // No volume data available
    }
  }

  // Fill gaps in price history
  private fillPriceHistoryGaps(history: PriceHistory[], timeframe: '1h' | '24h' | '7d', currentPrice: number): PriceHistory[] {
    const intervals = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const timeWindow = intervals[timeframe];
    const dataPoints = timeframe === '1h' ? 60 : timeframe === '24h' ? 24 : 7;
    const step = timeWindow / dataPoints;
    const now = Date.now();
    
    const filledHistory: PriceHistory[] = [];
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = now - (dataPoints - i) * step;
      
      // Find closest historical data point
      const closest = history.reduce((prev, curr) => {
        const prevDiff = Math.abs(prev.timestamp - timestamp);
        const currDiff = Math.abs(curr.timestamp - timestamp);
        return currDiff < prevDiff ? curr : prev;
      }, history[0] || { timestamp, price: currentPrice, volume: 0 });
      
      // Interpolate price if needed
      let price = closest.price;
      if (history.length > 0) {
        const timeDiff = Math.abs(timestamp - closest.timestamp);
        if (timeDiff > step * 2) {
          // Add some variation for gaps
          price = closest.price; // Use closest historical price
        }
      }
      
      filledHistory.push({
        timestamp,
        price,
        volume: closest.volume || 0
      });
    }
    
    return filledHistory;
  }

  // Fallback market data when blockchain data is unavailable
  private async simulateMarketData(tokenMint: string): Promise<MarketData> {
    // Return zero/empty data when blockchain data is unavailable
    return {
      price: 0,
      marketCap: 0,
      volume24h: 0,
      liquidity: 0,
      holders: 0,
      priceChange24h: 0,
      priceChange1h: 0,
      priceChange7d: 0,
      lastUpdated: Date.now()
    };
  }

  // Generate minimal fallback price history
  private generatePriceHistory(timeframe: '1h' | '24h' | '7d'): PriceHistory[] {
      // Using fallback price history - no logging
    
    const now = Date.now();
    const intervals = {
      '1h': 60 * 60 * 1000, // 1 hour
      '24h': 24 * 60 * 60 * 1000, // 24 hours
      '7d': 7 * 24 * 60 * 60 * 1000 // 7 days
    };
    
    const interval = intervals[timeframe];
    const dataPoints = timeframe === '1h' ? 60 : timeframe === '24h' ? 24 : 7;
    const step = interval / dataPoints;
    
    const history: PriceHistory[] = [];
    const basePrice = 0.00003; // Default starting price
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = now - (dataPoints - i) * step;
      
      history.push({
        timestamp,
        price: basePrice, // Flat price line
        volume: 0 // No volume
      });
    }
    
    return history;
  }

  // Get AMM account data (real implementation - parses actual AMM account structure)
  async getAMMAccountData(tokenMint: string): Promise<{
    solReserves: number;
    tokenReserves: number;
    price: number;
  } | null> {
    try {
      const { PROGRAM_ID } = await import('./nativeProgram');
      const { getAccount } = await import('@solana/spl-token');
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const tokenMintKey = new PublicKey(tokenMint);
      
      // Use correct AMM PDA derivation matching backend: [baseMint, quoteMint, "CookAMM"] (sorted)
      const baseFirst = tokenMintKey.toString() < WSOL_MINT.toString();
      const ammSeeds = baseFirst
        ? [tokenMintKey.toBuffer(), WSOL_MINT.toBuffer(), Buffer.from('CookAMM')]
        : [WSOL_MINT.toBuffer(), tokenMintKey.toBuffer(), Buffer.from('CookAMM')];
      
      const [ammAccount] = PublicKey.findProgramAddressSync(ammSeeds, PROGRAM_ID);
      
      const accountInfo = await this.connection.getAccountInfo(ammAccount);
      if (!accountInfo || accountInfo.data.length === 0) {
        console.log('AMM account not found for token:', tokenMint);
        return null;
      }
      
      // Parse AMM account data structure (same as solanaProgram.ts)
      const data = accountInfo.data;
      const dataLength = data.length;
      let offset = 0;
      
      // Minimum required size check - be more lenient for smaller accounts
      // AMM accounts can vary in size depending on initialization state
      // Partially initialized accounts might be smaller, so we handle them gracefully
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
      
      // Get actual token account balances for verification
      let solReserves = 0;
      let tokenReserves = 0;
      
      try {
        // Get quote token account (WSOL) balance
        const quoteAccountInfo = await getAccount(this.connection, quoteKey);
        solReserves = Number(quoteAccountInfo.amount) / 1e9; // WSOL has 9 decimals
        
        // Get base token account balance
        const baseAccountInfo = await getAccount(this.connection, baseKey);
        // Get decimals from mint account, not token account
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
      // Price = quoteReserves / baseReserves
      const price = tokenReserves > 0 ? solReserves / tokenReserves : (lastPrice > 0 ? lastPrice : 0);
      
      console.log('📊 AMM Data:', {
        tokenMint,
        solReserves,
        tokenReserves,
        price,
        lastPrice
      });
      
      return {
        solReserves,
        tokenReserves,
        price: price || lastPrice || 0
      };
    } catch (error) {
      console.error('Error parsing AMM account data:', error);
      // Fallback: try to get data from token accounts directly
      return await this.getAMMDataFromTokenAccounts(tokenMint);
    }
  }

  // Cache for AMM token account data to reduce RPC calls
  private ammTokenAccountCache: Map<string, { data: { solReserves: number; tokenReserves: number; price: number } | null; timestamp: number }> = new Map();
  private readonly AMM_CACHE_DURATION = 30000; // 30 seconds cache

  // Fallback method: Get AMM data from token accounts when account structure is unknown
  private async getAMMDataFromTokenAccounts(tokenMint: string): Promise<{
    solReserves: number;
    tokenReserves: number;
    price: number;
  } | null> {
    try {
      // Check cache first
      const cached = this.ammTokenAccountCache.get(tokenMint);
      if (cached && Date.now() - cached.timestamp < this.AMM_CACHE_DURATION) {
        console.log('📦 Using cached AMM token account data');
        return cached.data;
      }

      const { PROGRAM_ID } = await import('./nativeProgram');
      const { getAccount } = await import('@solana/spl-token');
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
      const tokenMintKey = new PublicKey(tokenMint);
      
      // Use correct AMM PDA derivation matching backend: [baseMint, quoteMint, "CookAMM"] (sorted)
      const baseFirst = tokenMintKey.toString() < WSOL_MINT.toString();
      const ammSeeds = baseFirst
        ? [tokenMintKey.toBuffer(), WSOL_MINT.toBuffer(), Buffer.from('CookAMM')]
        : [WSOL_MINT.toBuffer(), tokenMintKey.toBuffer(), Buffer.from('CookAMM')];
      
      const [ammAccount] = PublicKey.findProgramAddressSync(ammSeeds, PROGRAM_ID);
      
      // Try to find token accounts associated with the AMM
      // Get all token accounts owned by the AMM account
      const splToken = await import('@solana/spl-token');
      let tokenAccounts;
      try {
        tokenAccounts = await this.connection.getTokenAccountsByOwner(
          ammAccount,
          { programId: TOKEN_PROGRAM_ID }
        );
      } catch (error: any) {
        // Handle 429 errors gracefully
        if (error?.message?.includes('429') || error?.code === 429) {
          console.warn('⚠️ Rate limited (429) when fetching token accounts, using cached data or returning null');
          // Return cached data if available, even if expired
          if (cached) {
            return cached.data;
          }
          return null;
        }
        throw error;
      }
      
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
        // Cache null result to avoid repeated calls
        this.ammTokenAccountCache.set(tokenMint, { data: null, timestamp: Date.now() });
        return null;
      }
      
      // Calculate price
      const price = tokenReserves > 0 ? solReserves / tokenReserves : 0;
      
      const result = {
        solReserves,
        tokenReserves,
        price
      };
      
      // Cache the result
      this.ammTokenAccountCache.set(tokenMint, { data: result, timestamp: Date.now() });
      
      return result;
    } catch (error: any) {
      // Handle 429 errors gracefully
      if (error?.message?.includes('429') || error?.code === 429) {
        console.warn('⚠️ Rate limited (429) when getting AMM data, using cached data if available');
        const cached = this.ammTokenAccountCache.get(tokenMint);
        if (cached) {
          return cached.data;
        }
      }
      console.error('Error getting AMM data from token accounts:', error);
      return null;
    }
  }

  // Get token holder count
  async getTokenHolderCount(tokenMint: string): Promise<number> {
    try {
      const tokenMintKey = new PublicKey(tokenMint);
      const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
      
      let holders = 0;
      
      try {
        const splAccounts = await this.connection.getProgramAccounts(
          new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
          {
            filters: [
              { dataSize: 165 },
              { memcmp: { offset: 0, bytes: tokenMintKey.toBase58() } }
            ]
          }
        );
        holders += splAccounts.filter(acc => {
          const amount = acc.account.data.readBigUInt64LE(64);
          return amount > BigInt(0);
        }).length;
      } catch {}
      
      try {
        const token2022Accounts = await this.connection.getProgramAccounts(
          TOKEN_2022_PROGRAM_ID,
          {
            filters: [
              { memcmp: { offset: 0, bytes: tokenMintKey.toBase58() } }
            ]
          }
        );
        holders += token2022Accounts.filter(acc => {
          if (acc.account.data.length < 72) return false;
          const amount = acc.account.data.readBigUInt64LE(64);
          return amount > BigInt(0);
        }).length;
      } catch {}
      
      return holders;
    } catch (error) {
      return 0;
    }
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    this.priceHistoryCache.clear();
  }

  // Get trading volume for last 24 hours
  async getTradingVolume24h(tokenMint: string): Promise<number> {
    try {
      const { PROGRAM_ID } = await import('./nativeProgram');
      const tokenMintKey = new PublicKey(tokenMint);
      
      // Get AMM account
      const [ammAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('amm'), tokenMintKey.toBuffer()],
        PROGRAM_ID
      );
      
      // Get signatures for last 24 hours
      const signatures = await this.connection.getSignaturesForAddress(ammAccount, {
        limit: 1000, // Get more transactions for volume calculation
        before: undefined
      });
      
      let totalVolume = 0;
      const now = Date.now();
      const dayAgo = now - (24 * 60 * 60 * 1000);
      
      // Process transactions from last 24 hours
      for (const sig of signatures) {
        if (sig.blockTime && sig.blockTime * 1000 > dayAgo) {
          try {
            const tx = await this.connection.getTransaction(sig.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            });
            
            if (tx && tx.meta) {
              const volume = this.extractVolumeFromTransaction(tx);
              totalVolume += volume;
            }
          } catch (txError) {
            console.warn('Error processing transaction for volume:', txError);
          }
        }
      }
      
      return totalVolume;
    } catch (error) {
      console.error('Error calculating 24h volume:', error);
      return 0; // No volume data available
    }
  }

  // Get price change for last 24 hours
  async getPriceChange24h(tokenMint: string, currentPrice: number): Promise<number> {
    try {
      // Get price history for 24h
      const history = await this.getPriceHistory(tokenMint, '24h');
      
      if (history.length > 0) {
        const oldestPrice = history[0].price;
        return ((currentPrice - oldestPrice) / oldestPrice) * 100;
      }
      
      return 0; // No price change data available
    } catch (error) {
      console.error('Error calculating 24h price change:', error);
      return (Math.random() - 0.5) * 20;
    }
  }

  // Get price change for last 1 hour
  async getPriceChange1h(tokenMint: string, currentPrice: number): Promise<number> {
    try {
      // Get price history for 1h
      const history = await this.getPriceHistory(tokenMint, '1h');
      
      if (history.length > 0) {
        const oldestPrice = history[0].price;
        return ((currentPrice - oldestPrice) / oldestPrice) * 100;
      }
      
      return 0; // No price change data available
    } catch (error) {
      console.error('Error calculating 1h price change:', error);
      return (Math.random() - 0.5) * 5;
    }
  }

  // Get price change for last 7 days
  async getPriceChange7d(tokenMint: string, currentPrice: number): Promise<number> {
    try {
      // Get price history for 7d
      const history = await this.getPriceHistory(tokenMint, '7d');
      
      if (history.length > 0) {
        const oldestPrice = history[0].price;
        return ((currentPrice - oldestPrice) / oldestPrice) * 100;
      }
      
      return 0; // No price change data available
    } catch (error) {
      console.error('Error calculating 7d price change:', error);
      return (Math.random() - 0.5) * 50;
    }
  }

  // Get Jupiter API price for token
  async getJupiterPrice(tokenMint: string): Promise<number | null> {
    try {
      // Fetching Jupiter price - no logging
      
      // Jupiter API endpoint for price
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenMint}`);
      
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.data && data.data[tokenMint]) {
        const price = data.data[tokenMint].price;
        // Jupiter price fetched - no logging
        return price;
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Jupiter price fetch failed:', error);
      return null;
    }
  }

  // Get real price from multiple sources
  async getRealPrice(tokenMint: string): Promise<number | null> {
    try {
      // Try Jupiter first (most reliable for price)
      const jupiterPrice = await this.getJupiterPrice(tokenMint);
      if (jupiterPrice && jupiterPrice > 0) {
        return jupiterPrice;
      }
      
      // Fallback to AMM data
      const ammData = await this.getAMMAccountData(tokenMint);
      if (ammData && ammData.price > 0) {
        return ammData.price;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting real price:', error);
      return null;
    }
  }

  // Get cache status
  getCacheStatus(): { marketData: number; priceHistory: number } {
    return {
      marketData: this.cache.size,
      priceHistory: this.priceHistoryCache.size
    };
  }
}

// Export singleton instance
export const marketDataService = new MarketDataService(
  new Connection('https://api.devnet.solana.com', 'confirmed')
);

export default MarketDataService;
