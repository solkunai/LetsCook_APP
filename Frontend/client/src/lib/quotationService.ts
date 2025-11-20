/**
 * Quotation Service - FIXED VERSION
 * 
 * Dedicated service for fetching and calculating swap quotes
 * ALWAYS uses Supabase as source of truth for current_price, tokens_sold, and pool_sol_balance
 * Falls back to blockchain queries if Supabase doesn't have the data
 * 
 * CRITICAL FIXES:
 * 1. Proper bonding curve integration for buy/sell
 * 2. Price validation (no more 447,000% impacts!)
 * 3. Average price calculation fixed
 * 4. All decimals handled properly
 */

import { PublicKey, Connection } from '@solana/web3.js';
import { bondingCurveService } from './bondingCurveService';
import { TradingService } from './tradingService';
import { LaunchMetadataService } from './launchMetadataService';

export interface SwapQuote {
  tokensReceived?: number; // Human-readable token amount
  solReceived?: number; // Human-readable SOL amount
  priceImpact: number; // Percentage
  avgPrice: number; // SOL per token
  currentPrice: number; // Current price before trade
  postTradePrice: number; // Price after trade
  source: 'trading_service' | 'bonding_curve' | 'amm_pool';
  validation?: string; // Optional validation warning/error
}

export class QuotationService {
  private connection: Connection;
  private tradingService: TradingService;

  constructor(connection: Connection) {
    this.connection = connection;
    this.tradingService = new TradingService(connection);
  }

  /**
   * Get quote for buying tokens with SOL
   * ALWAYS fetches latest current_price, tokens_sold from Supabase first (source of truth)
   */
  async getBuyQuote(
    tokenMint: string,
    solAmount: number,
    totalSupply: number,
    tokensSold: number, // Fallback value if Supabase doesn't have it
    decimals: number,
    currentPrice: number // Fallback value if Supabase doesn't have it
  ): Promise<SwapQuote> {
    // STEP 1: Fetch latest state from Supabase (source of truth)
    let latestTokensSold = tokensSold;
    let latestCurrentPrice = currentPrice;
    let latestTotalSupply = totalSupply;
    let latestDecimals = decimals;
    
    try {
      const metadata = await LaunchMetadataService.getMetadataByTokenMint(tokenMint);
      if (metadata) {
        // Use Supabase values if available (they're always up-to-date after trades)
        if (metadata.tokens_sold !== undefined && metadata.tokens_sold !== null) {
          latestTokensSold = metadata.tokens_sold;
        }
        if (metadata.current_price !== undefined && metadata.current_price !== null && metadata.current_price > 0) {
          latestCurrentPrice = metadata.current_price;
        }
        if (metadata.total_supply !== undefined && metadata.total_supply !== null) {
          latestTotalSupply = metadata.total_supply;
        }
        if (metadata.decimals !== undefined && metadata.decimals !== null) {
          latestDecimals = metadata.decimals;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch latest state from Supabase, using fallback values:', error);
    }

    // STEP 2: If current price is still invalid, calculate it from bonding curve
    if (latestCurrentPrice <= 0) {
      const bondingCurveConfig = {
        realSupply: latestTotalSupply, // CRITICAL: Use real supply
        decimals: latestDecimals,
        curveType: 'linear' as const,
      };
      latestCurrentPrice = bondingCurveService.calculatePrice(latestTokensSold, bondingCurveConfig);
    }

    const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111112');
    const tokenMintKey = new PublicKey(tokenMint);

    // STEP 3: Try to get real quote from trading service first
    try {
      const quote = await this.tradingService.getSwapQuote(
        WSOL_MINT,
        tokenMintKey,
        solAmount,
        'cook'
      );

      if (quote && quote.outputAmount > 0 && isFinite(quote.outputAmount)) {
        // quote.outputAmount is in human-readable format
        const tokensReceived = quote.outputAmount;
        const postBuyTokensSold = latestTokensSold + tokensReceived;
        
        const bondingCurveConfig = {
          realSupply: latestTotalSupply,
          decimals: latestDecimals,
          curveType: 'linear' as const,
        };
        
        const postTradePrice = bondingCurveService.calculatePrice(postBuyTokensSold, bondingCurveConfig);
        const avgPrice = tokensReceived > 0 ? solAmount / tokensReceived : latestCurrentPrice;
        const priceImpact = latestCurrentPrice > 0 
          ? ((postTradePrice - latestCurrentPrice) / latestCurrentPrice) * 100 
          : 0;

        return {
          tokensReceived,
          priceImpact: quote.priceImpact || priceImpact,
          avgPrice,
          currentPrice: latestCurrentPrice, // Use latest from Supabase
          postTradePrice,
          source: 'trading_service'
        };
      }
    } catch (error) {
      // Fall through to bonding curve calculation
    }

    // STEP 4: Fallback to bonding curve calculation using latest values
    return this.getBondingCurveBuyQuote(
      solAmount,
      latestTotalSupply,
      latestTokensSold,
      latestDecimals,
      latestCurrentPrice
    );
  }

  /**
   * Get quote for selling tokens for SOL
   * ALWAYS fetches latest current_price, tokens_sold from Supabase first (source of truth)
   */
  async getSellQuote(
    tokenMint: string,
    tokenAmount: number,
    totalSupply: number,
    tokensSold: number, // Fallback value if Supabase doesn't have it
    decimals: number,
    currentPrice: number // Fallback value if Supabase doesn't have it
  ): Promise<SwapQuote> {
    // STEP 1: Fetch latest state from Supabase (source of truth)
    let latestTokensSold = tokensSold;
    let latestCurrentPrice = currentPrice;
    let latestTotalSupply = totalSupply;
    let latestDecimals = decimals;
    
    try {
      const metadata = await LaunchMetadataService.getMetadataByTokenMint(tokenMint);
      if (metadata) {
        // Use Supabase values if available
        if (metadata.tokens_sold !== undefined && metadata.tokens_sold !== null) {
          latestTokensSold = metadata.tokens_sold;
        }
        if (metadata.current_price !== undefined && metadata.current_price !== null && metadata.current_price > 0) {
          latestCurrentPrice = metadata.current_price;
        }
        if (metadata.total_supply !== undefined && metadata.total_supply !== null) {
          latestTotalSupply = metadata.total_supply;
        }
        if (metadata.decimals !== undefined && metadata.decimals !== null) {
          latestDecimals = metadata.decimals;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch latest state from Supabase, using fallback values:', error);
    }

    // STEP 2: If current price is still invalid, calculate it from bonding curve
    if (latestCurrentPrice <= 0) {
      const bondingCurveConfig = {
        realSupply: latestTotalSupply,
        decimals: latestDecimals,
        curveType: 'linear' as const,
      };
      latestCurrentPrice = bondingCurveService.calculatePrice(latestTokensSold, bondingCurveConfig);
    }

    const tokenMintKey = new PublicKey(tokenMint);
    const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111112');

    // STEP 3: Try to get real quote from trading service first
    try {
      const quote = await this.tradingService.getSwapQuote(
        tokenMintKey,
        WSOL_MINT,
        tokenAmount,
        'cook'
      );

      if (quote && quote.outputAmount > 0 && isFinite(quote.outputAmount)) {
        // quote.outputAmount is in SOL (human-readable)
        const solReceived = quote.outputAmount;
        const postSellTokensSold = Math.max(0, latestTokensSold - tokenAmount);
        
        const bondingCurveConfig = {
          realSupply: latestTotalSupply,
          decimals: latestDecimals,
          curveType: 'linear' as const,
        };
        
        const postTradePrice = bondingCurveService.calculatePrice(postSellTokensSold, bondingCurveConfig);
        const avgPrice = tokenAmount > 0 ? solReceived / tokenAmount : latestCurrentPrice;
        const priceImpact = latestCurrentPrice > 0 
          ? ((latestCurrentPrice - postTradePrice) / latestCurrentPrice) * 100 
          : 0;

        return {
          solReceived,
          priceImpact: quote.priceImpact || priceImpact,
          avgPrice,
          currentPrice: latestCurrentPrice, // Use latest from Supabase
          postTradePrice,
          source: 'trading_service'
        };
      }
    } catch (error) {
      // Fall through to bonding curve calculation
    }

    // STEP 4: Fallback to bonding curve calculation using latest values
    return this.getBondingCurveSellQuote(
      tokenAmount,
      latestTotalSupply,
      latestTokensSold,
      latestDecimals,
      latestCurrentPrice
    );
  }

  /**
   * Calculate buy quote using bonding curve formula - FIXED VERSION
   * 
   * For a linear bonding curve: P(x) = initial_price + slope×x
   * 
   * To calculate tokens for SOL amount, we integrate:
   * SOL = ∫(initial_price + slope×x)dx from x0 to x1
   * SOL = initial_price×(x1-x0) + (slope/2)×(x1²-x0²)
   * 
   * Solving for x1 using quadratic formula:
   * slope×x1² + 2×initial_price×x1 - C = 0
   * Where C = 2×SOL + slope×x0² + 2×initial_price×x0
   */
  private getBondingCurveBuyQuote(
    solAmount: number,
    totalSupply: number,
    tokensSold: number,
    decimals: number,
    currentPrice: number
  ): SwapQuote {
    const config = {
      realSupply: totalSupply, // CRITICAL: Use real supply for calculations
      decimals,
      curveType: 'linear' as const,
    };

    // Calculate current price from bonding curve
    const calculatedCurrentPrice = bondingCurveService.calculatePrice(tokensSold, config);
    
    // Use calculated price if provided price seems invalid
    const actualCurrentPrice = (currentPrice > 0 && currentPrice < 1) 
      ? currentPrice 
      : calculatedCurrentPrice;

    // Use the bonding curve integration to calculate tokens
    const tokensReceived = bondingCurveService.calculateTokensForSol(
      solAmount,
      tokensSold, // Human-readable format
      config
    );

    // Validate result
    if (!isFinite(tokensReceived) || tokensReceived <= 0) {
      console.warn('⚠️ Invalid tokens calculation:', tokensReceived);
      return {
        tokensReceived: 0,
        priceImpact: 0,
        avgPrice: actualCurrentPrice,
        currentPrice: actualCurrentPrice,
        postTradePrice: actualCurrentPrice,
        source: 'bonding_curve',
        validation: 'Calculation failed'
      };
    }

    // Safety check: ensure tokens don't exceed available supply
    const maxAvailable = totalSupply - tokensSold;
    const finalTokensReceived = Math.min(tokensReceived, maxAvailable);

    // Calculate post-buy price
    const postBuyTokensSold = tokensSold + finalTokensReceived;
    const postTradePrice = bondingCurveService.calculatePrice(postBuyTokensSold, config);

    // Calculate price impact
    const priceImpact = actualCurrentPrice > 0 
      ? ((postTradePrice - actualCurrentPrice) / actualCurrentPrice) * 100 
      : 0;

    // Average price is what you actually paid per token
    const avgPrice = finalTokensReceived > 0 ? solAmount / finalTokensReceived : actualCurrentPrice;

    // Validate the trade
    const validationError = bondingCurveService.validateTrade({
      solAmount,
      currentPrice: actualCurrentPrice,
      avgPrice,
      priceImpact,
      tokensReceived: finalTokensReceived
    });

    console.log(`💰 Buy Quote Calculated:
      SOL Amount: ${solAmount}
      Tokens Sold Before: ${tokensSold.toLocaleString()}
      Tokens Received: ${finalTokensReceived.toLocaleString()}
      Current Price: ${bondingCurveService.formatPrice(actualCurrentPrice)} SOL
      Post-Trade Price: ${bondingCurveService.formatPrice(postTradePrice)} SOL
      Average Price: ${bondingCurveService.formatPrice(avgPrice)} SOL
      Price Impact: ${priceImpact.toFixed(2)}%
      ${validationError ? `⚠️ Validation Warning: ${validationError}` : '✅ Valid'}
    `);

    return {
      tokensReceived: finalTokensReceived,
      priceImpact,
      avgPrice,
      currentPrice: actualCurrentPrice,
      postTradePrice,
      source: 'bonding_curve',
      validation: validationError || undefined
    };
  }

  /**
   * Calculate sell quote using bonding curve formula - FIXED VERSION
   */
  private getBondingCurveSellQuote(
    tokenAmount: number,
    totalSupply: number,
    tokensSold: number,
    decimals: number,
    currentPrice: number
  ): SwapQuote {
    const config = {
      realSupply: totalSupply,
      decimals,
      curveType: 'linear' as const,
    };

    // Calculate current price from bonding curve
    const calculatedCurrentPrice = bondingCurveService.calculatePrice(tokensSold, config);
    
    // Use calculated price if provided price seems invalid
    const actualCurrentPrice = (currentPrice > 0 && currentPrice < 1) 
      ? currentPrice 
      : calculatedCurrentPrice;

    // Safety check: can't sell more than what's been sold
    if (tokenAmount > tokensSold) {
      console.warn('⚠️ Trying to sell more tokens than available');
      return {
        solReceived: 0,
        priceImpact: 0,
        avgPrice: actualCurrentPrice,
        currentPrice: actualCurrentPrice,
        postTradePrice: actualCurrentPrice,
        source: 'bonding_curve',
        validation: 'Cannot sell more than available'
      };
    }

    // Calculate SOL received using bonding curve integration
    const solReceived = bondingCurveService.calculateSolForTokens(
      tokenAmount,
      tokensSold,
      config
    );

    // Calculate post-sell price
    const postSellTokensSold = Math.max(0, tokensSold - tokenAmount);
    const postTradePrice = bondingCurveService.calculatePrice(postSellTokensSold, config);

    // Calculate price impact (negative for sells)
    const priceImpact = actualCurrentPrice > 0 
      ? ((postTradePrice - actualCurrentPrice) / actualCurrentPrice) * 100 
      : 0;

    // Calculate average price
    const avgPrice = tokenAmount > 0 
      ? solReceived / tokenAmount 
      : actualCurrentPrice;

    // Validate the trade
    const validationError = bondingCurveService.validateTrade({
      tokenAmount,
      currentPrice: actualCurrentPrice,
      avgPrice,
      priceImpact
    });

    console.log(`💰 Sell Quote Calculated:
      Token Amount: ${tokenAmount.toLocaleString()}
      Tokens Sold Before: ${tokensSold.toLocaleString()}
      SOL Received: ${solReceived.toFixed(6)}
      Current Price: ${bondingCurveService.formatPrice(actualCurrentPrice)} SOL
      Post-Trade Price: ${bondingCurveService.formatPrice(postTradePrice)} SOL
      Average Price: ${bondingCurveService.formatPrice(avgPrice)} SOL
      Price Impact: ${priceImpact.toFixed(2)}%
      ${validationError ? `⚠️ Validation Warning: ${validationError}` : '✅ Valid'}
    `);

    return {
      solReceived,
      priceImpact,
      avgPrice,
      currentPrice: actualCurrentPrice,
      postTradePrice,
      source: 'bonding_curve',
      validation: validationError || undefined
    };
  }
}

export const quotationService = new QuotationService(
  new (await import('@solana/web3.js')).Connection(
    'https://api.devnet.solana.com',
    'confirmed'
  )
);
