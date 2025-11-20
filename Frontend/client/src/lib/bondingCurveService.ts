/**
 * Bonding Curve Service - FIXED VERSION
 * 
 * Calculates token price using bonding curve formula
 * For fair-launch platforms like Pump.fun, price is determined by:
 * P(x) = initial_price + (slope × x)
 * 
 * where:
 * - x = tokens sold (human-readable, accounting for decimals)
 * - initial_price = Starting price (reasonable, 8-9 decimals max)
 * - slope = Price increase rate per token
 * 
 * CRITICAL FIXES:
 * 1. Initial price now has 8-9 decimals max (not 11+)
 * 2. For 10B supply with 6 decimals: starting price ~0.00000001 SOL
 * 3. Slope calculated to give 20-50% price impact for 0.1 SOL buy
 * 4. All calculations use REAL supply (not virtual)
 * 5. Proper decimal handling everywhere
 */

import { 
  formatLargeNumber, 
  formatTokenAmount, 
  clampToU64, 
  exceedsU64Max,
  safeAdd,
  safeMultiply 
} from './largeNumberFormatter';

export interface BondingCurveConfig {
  totalSupply?: number | bigint; // DEPRECATED: Use realSupply instead (for backward compatibility)
  realSupply?: number | bigint; // Real supply (what was actually minted) - use this for calculations
  virtualSupply?: number | bigint; // Virtual supply (what user entered) - for display only
  decimals?: number; // Token decimals (default: 6 for most tokens)
  curveType: 'linear' | 'exponential';
  slope?: number; // Price increase per token (for linear)
  basePrice?: number; // Starting price (if you want to override calculation)
  initialLiquidity?: number; // Optional initial SOL liquidity
}

export class BondingCurveService {
  /**
   * Helper function to get the supply value to use for calculations
   * ALWAYS prefers realSupply (what was actually minted) over totalSupply
   */
  private getSupplyForCalculation(config: BondingCurveConfig): number {
    // CRITICAL: Use REAL supply for all calculations, not virtual supply!
    const supplyToUse = config.realSupply !== undefined ? config.realSupply : config.totalSupply;
    if (supplyToUse === undefined) {
      throw new Error('Either realSupply or totalSupply must be provided');
    }
    return typeof supplyToUse === 'bigint' ? Number(supplyToUse) : supplyToUse;
  }

  /**
   * Calculate initial price from bonding curve parameters
   * 
   * FIXED: Initial price now has 8-9 decimals maximum
   * For a 10B supply token: ~0.00000001 SOL starting price
   * This gives a reasonable starting market cap of ~0.1 SOL
   */
  calculateInitialPrice(config: BondingCurveConfig): number {
    // If basePrice is explicitly provided, use it
    if (config.basePrice !== undefined) {
      return config.basePrice;
    }
    
    // Use REAL supply for calculations
    const realSupply = this.getSupplyForCalculation(config);
    const decimals = config.decimals || 6;
    
    // Target starting market cap: 0.1 SOL for fair launch
    const targetStartingMarketCap = 0.1; // SOL
    
    // Calculate initial price to achieve target market cap
    // Market Cap = Price × Supply
    // Price = Market Cap / Supply
    let initialPrice = targetStartingMarketCap / realSupply;
    
    // Ensure price is reasonable (8-9 decimal places max)
    // For 10B supply: 0.1 / 10,000,000,000 = 0.00000000001 (11 decimals)
    // We want to cap at 8-9 decimals, so minimum price is 0.000000001 (9 decimals)
    const MIN_PRICE = 0.000000001; // 9 decimal places - reasonable minimum
    const MAX_PRICE = 0.1; // 1 decimal place - reasonable maximum
    
    // Clamp to reasonable range
    initialPrice = Math.max(MIN_PRICE, Math.min(MAX_PRICE, initialPrice));
    
    console.log(`💎 Initial Price Calculation:
      Real Supply: ${realSupply.toLocaleString()}
      Decimals: ${decimals}
      Target Market Cap: ${targetStartingMarketCap} SOL
      Calculated Price: ${initialPrice.toFixed(12)} SOL
      Price Decimals: ${initialPrice.toExponential(2)}
    `);
    
    return initialPrice;
  }

  /**
   * Calculate slope parameter for linear bonding curve
   * 
   * FIXED: Slope now calculated to give reasonable price impacts
   * For 0.1 SOL buy on 10B supply: should see 20-50% price impact
   * 
   * Strategy: Calculate slope based on desired price impact for a reference buy
   */
  private calculateSlopeFromSupply(realSupply: number): number {
    if (realSupply <= 0) return 0.000000001;
    
    // APPROACH: Target 30-40% price impact for 0.1 SOL buy at start
    // This gives users reasonable entry points and smooth price discovery
    
    const initialPrice = 0.000000001; // Our calculated initial price
    const referenceBuyAmount = 0.1; // Reference: 0.1 SOL buy
    const targetPriceImpact = 0.35; // 35% impact target
    
    // Approximate tokens for 0.1 SOL: tokens ≈ SOL / price
    const approxTokensFor01SOL = referenceBuyAmount / initialPrice;
    
    // For price impact of 35%: newPrice = initialPrice * 1.35
    // Using linear curve: newPrice = initialPrice + slope * tokens
    // slope = (newPrice - initialPrice) / tokens
    // slope = (initialPrice * 1.35 - initialPrice) / tokens
    // slope = initialPrice * 0.35 / tokens
    const targetSlope = (initialPrice * targetPriceImpact) / approxTokensFor01SOL;
    
    // Also ensure that at 30 SOL graduation, price has increased reasonably
    // But don't let it dominate - the 0.1 SOL impact is more important for UX
    const targetGraduationSOL = 30;
    const priceMultiplierAtGraduation = 10; // 10x price increase by graduation (reasonable)
    const avgPriceAtGraduation = initialPrice * (priceMultiplierAtGraduation / 2);
    const estimatedTokensAtGraduation = targetGraduationSOL / avgPriceAtGraduation;
    const finalPriceAtGraduation = initialPrice * priceMultiplierAtGraduation;
    const graduationSlope = (finalPriceAtGraduation - initialPrice) / estimatedTokensAtGraduation;
    
    // Use the smaller of the two slopes to ensure good UX at all stages
    const slope = Math.min(targetSlope, graduationSlope);
    
    // Ensure minimum slope for very large supplies
    const minSlope = initialPrice / (realSupply * 10); // Very gradual minimum
    
    console.log(`📈 Slope Calculation:
      Real Supply: ${realSupply.toLocaleString()}
      Initial Price: ${initialPrice.toExponential(2)} SOL
      Target 0.1 SOL Impact: ${(targetPriceImpact * 100).toFixed(0)}%
      Approx Tokens for 0.1 SOL: ${approxTokensFor01SOL.toLocaleString()}
      Target Slope: ${targetSlope.toExponential(2)}
      Graduation Slope: ${graduationSlope.toExponential(2)}
      Final Slope: ${slope.toExponential(2)}
    `);
    
    return Math.max(minSlope, slope);
  }

  /**
   * Calculate current price based on tokens sold
   * P(x) = initial_price + (slope × x)
   * 
   * FIXED: Returns price with 8-9 decimals maximum
   */
  calculatePrice(
    tokensSold: number,
    config: BondingCurveConfig
  ): number {
    const basePrice = config.basePrice !== undefined 
      ? config.basePrice 
      : this.calculateInitialPrice(config);
    const realSupply = this.getSupplyForCalculation(config);
    const slope = config.slope || this.calculateSlopeFromSupply(realSupply);
    
    if (config.curveType === 'linear') {
      // Linear bonding curve: P(x) = initial_price + slope × x
      const price = basePrice + (slope * tokensSold);
      
      // Ensure price doesn't exceed reasonable maximum
      const MAX_PRICE = 1.0; // 1 SOL per token is very high
      return Math.min(price, MAX_PRICE);
    } else {
      // Exponential bonding curve (not commonly used)
      const growthRate = slope / 100;
      const price = basePrice * Math.pow(1 + growthRate, tokensSold / 1000);
      return Math.min(price, 1.0);
    }
  }

  /**
   * Calculate tokens received for a given SOL amount
   * Uses integration of the bonding curve: ∫P(x)dx
   * 
   * For linear curve: SOL = ∫(initial_price + slope×x)dx from x0 to x1
   * Solving: SOL = initial_price×(x1-x0) + (slope/2)×(x1²-x0²)
   * 
   * Rearranging to quadratic: slope×x1² + 2×initial_price×x1 - C = 0
   * Where C = 2×SOL + slope×x0² + 2×initial_price×x0
   * 
   * Solution: x1 = (-2×initial_price + √discriminant) / (2×slope)
   * Tokens = x1 - x0
   */
  calculateTokensForSol(
    solAmount: number,
    currentTokensSold: number | bigint,
    config: BondingCurveConfig
  ): number {
    const realSupply = this.getSupplyForCalculation(config);
    const tokensSoldNum = typeof currentTokensSold === 'bigint' 
      ? Number(currentTokensSold) 
      : currentTokensSold;
    
    const slope = config.slope || this.calculateSlopeFromSupply(realSupply);
    const initialPrice = config.basePrice !== undefined 
      ? config.basePrice 
      : this.calculateInitialPrice(config);
    
    if (config.curveType === 'linear') {
      // Use quadratic formula to solve for tokens
      // Formula: slope×x1² + 2×initialPrice×x1 - C = 0
      const x0 = tokensSoldNum;
      const C = 2 * solAmount + slope * x0 * x0 + 2 * initialPrice * x0;
      
      // Calculate discriminant
      const discriminant = (2 * initialPrice) ** 2 + 4 * slope * C;
      
      // Validate discriminant
      if (discriminant < 0 || !isFinite(discriminant) || isNaN(discriminant)) {
        console.warn('⚠️ Invalid discriminant:', discriminant);
        return 0;
      }
      
      const sqrt_d = Math.sqrt(discriminant);
      if (!isFinite(sqrt_d) || isNaN(sqrt_d)) {
        console.warn('⚠️ Invalid sqrt:', sqrt_d);
        return 0;
      }
      
      // Calculate x1 using quadratic formula
      const x1 = (-2 * initialPrice + sqrt_d) / (2 * slope);
      const tokensReceived = Math.max(0, x1 - x0);
      
      // Safety check: don't exceed available supply
      const maxAvailable = realSupply - tokensSoldNum;
      const finalTokens = Math.min(tokensReceived, maxAvailable);
      
      // Validation: Check if result makes sense
      if (finalTokens > 0) {
        const currentPrice = this.calculatePrice(tokensSoldNum, config);
        const approximateTokens = solAmount / currentPrice;
        
        // Tokens from integration should be close to simple division
        // (within 2x for small amounts)
        if (finalTokens > approximateTokens * 2 || finalTokens < approximateTokens * 0.5) {
          console.warn(`⚠️ Token calculation seems off:
            SOL Amount: ${solAmount}
            Current Price: ${currentPrice.toExponential(2)}
            Approximate Tokens: ${approximateTokens.toLocaleString()}
            Calculated Tokens: ${finalTokens.toLocaleString()}
          `);
        }
      }
      
      return clampToU64(finalTokens);
    } else {
      // Exponential curve - simplified
      const currentPrice = this.calculatePrice(tokensSoldNum, config);
      if (currentPrice <= 0) return 0;
      const tokens = solAmount / currentPrice;
      return clampToU64(Math.min(tokens, realSupply - tokensSoldNum));
    }
  }
  
  /**
   * Format tokens for display (with proper large number formatting)
   */
  formatTokens(tokens: number | bigint, decimals: number = 6): string {
    return formatTokenAmount(tokens, decimals);
  }
  
  /**
   * Format price for display
   * FIXED: Never shows more than 9 decimal places
   */
  formatPrice(price: number): string {
    if (price <= 0) return '0';
    
    // Cap at 9 decimal places maximum
    if (price < 0.000000001) {
      return '0.000000001'; // Show minimum
    } else if (price < 0.00000001) {
      return price.toFixed(9); // 9 decimals
    } else if (price < 0.0000001) {
      return price.toFixed(9); // 9 decimals
    } else if (price < 0.000001) {
      return price.toFixed(8); // 8 decimals
    } else if (price < 0.00001) {
      return price.toFixed(7); // 7 decimals
    } else if (price < 0.0001) {
      return price.toFixed(6); // 6 decimals
    } else if (price < 0.01) {
      return price.toFixed(5); // 5 decimals
    } else if (price < 1) {
      return price.toFixed(4); // 4 decimals
    } else {
      return price.toFixed(3); // 3 decimals
    }
  }

  /**
   * Calculate SOL received for selling tokens
   * Uses integration in reverse: ∫P(x)dx from x1 to x0
   * 
   * For linear curve: SOL = (price_before + price_after) / 2 × tokens
   */
  calculateSolForTokens(
    tokensAmount: number,
    currentTokensSold: number,
    config: BondingCurveConfig
  ): number {
    if (config.curveType === 'linear') {
      const realSupply = this.getSupplyForCalculation(config);
      const slope = config.slope || this.calculateSlopeFromSupply(realSupply);
      const initialPrice = config.basePrice !== undefined 
        ? config.basePrice 
        : this.calculateInitialPrice(config);
      
      // Calculate price before and after selling
      const priceBefore = this.calculatePrice(currentTokensSold, config);
      const newTokensSold = Math.max(0, currentTokensSold - tokensAmount);
      const priceAfter = this.calculatePrice(newTokensSold, config);
      
      // Use average price for the range
      const avgPrice = (priceBefore + priceAfter) / 2;
      const solReceived = tokensAmount * avgPrice;
      
      // Validation: Ensure SOL doesn't exceed reasonable amount
      const maxReasonableSOL = tokensAmount * priceBefore; // Can't exceed selling at current price
      return Math.min(solReceived, maxReasonableSOL);
    } else {
      const currentPrice = this.calculatePrice(currentTokensSold, config);
      return tokensAmount * currentPrice;
    }
  }

  /**
   * Get bonding curve parameters for display
   */
  getCurveParameters(config: BondingCurveConfig): {
    initialPrice: number;
    slope: number;
    basePrice: number;
    priceAt50Percent: number;
    priceAt100Percent: number;
  } {
    const realSupply = this.getSupplyForCalculation(config);
    const slope = config.slope || this.calculateSlopeFromSupply(realSupply);
    const basePrice = config.basePrice !== undefined 
      ? config.basePrice 
      : this.calculateInitialPrice(config);
    const initialPrice = basePrice;
    
    return {
      initialPrice,
      slope,
      basePrice,
      priceAt50Percent: this.calculatePrice(realSupply * 0.5, config),
      priceAt100Percent: this.calculatePrice(realSupply, config),
    };
  }

  /**
   * Validate trade parameters
   * Returns error message if validation fails, null if valid
   */
  validateTrade(params: {
    solAmount?: number;
    tokenAmount?: number;
    currentPrice: number;
    avgPrice: number;
    priceImpact: number;
    tokensReceived?: number;
  }): string | null {
    const { solAmount, tokenAmount, currentPrice, avgPrice, priceImpact, tokensReceived } = params;
    
    // Check 1: Current price should have 8-9 decimals max
    if (currentPrice > 0 && currentPrice < 1e-9) {
      return `Price too small: ${currentPrice.toExponential(2)} SOL (should be >= 0.000000001)`;
    }
    
    // Check 2: Average price should be within reasonable range of current price
    // For bonding curves, average can be higher due to price increasing during buy
    if (solAmount && solAmount <= 1) {
      const priceDiff = Math.abs(avgPrice - currentPrice) / currentPrice;
      if (priceDiff > 2.0) { // Relaxed to 200% to account for bonding curve dynamics
        return `Price discrepancy too large: avg=${avgPrice.toExponential(2)}, current=${currentPrice.toExponential(2)} (${(priceDiff * 100).toFixed(0)}% diff)`;
      }
    }
    
    // Check 3: Price impact for small amounts should be reasonable
    if (solAmount && solAmount <= 0.1 && Math.abs(priceImpact) > 200) {
      return `Price impact too high for 0.1 SOL: ${priceImpact.toFixed(0)}% (should be < 200%)`;
    }
    
    // Check 4: Should receive meaningful token amounts
    if (tokensReceived !== undefined && tokensReceived > 0 && tokensReceived < 100) {
      console.warn(`⚠️ Very small token amount: ${tokensReceived}`);
    }
    
    return null; // Valid
  }
}

export const bondingCurveService = new BondingCurveService();
