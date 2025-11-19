/**
 * Bonding Curve Service
 * 
 * Calculates token price using bonding curve formula
 * For fair-launch platforms like Pump.fun, price is determined by:
 * P(x) = a * x + b
 * where:
 * - x = tokens sold (supply in circulation)
 * - a = slope parameter (price increase per token)
 * - b = base price (starting price, often near 0)
 * 
 * Price increases as more tokens are bought and decreases when sold
 * 
 * Updated to support large supplies (billions, trillions) with BigInt-safe math
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
  decimals?: number; // Token decimals (default: 9)
  curveType: 'linear' | 'exponential';
  slope?: number; // Price increase per token (for linear)
  basePrice?: number; // Starting price (default: very small, near 0)
  initialLiquidity?: number; // Optional initial SOL liquidity
}

export class BondingCurveService {
  /**
   * Helper function to get the supply value to use for calculations
   * Prefers realSupply (what was actually minted) over totalSupply (for backward compatibility)
   */
  private getSupplyForCalculation(config: BondingCurveConfig): number {
    const supplyToUse = config.realSupply !== undefined ? config.realSupply : config.totalSupply;
    if (supplyToUse === undefined) {
      throw new Error('Either realSupply or totalSupply must be provided');
    }
    return typeof supplyToUse === 'bigint' ? Number(supplyToUse) : supplyToUse;
  }

  /**
   * Calculate initial price from bonding curve parameters
   * For a fair launch, initial price is determined by the curve formula at x=0
   * Initial price scales inversely with supply: higher supply = lower initial price per token
   * Supports large supplies (billions, trillions) with proper scaling
   */
  calculateInitialPrice(config: BondingCurveConfig): number {
    // If basePrice is explicitly provided, use it
    if (config.basePrice !== undefined) {
      return config.basePrice;
    }
    
    // Use realSupply if provided, otherwise fall back to totalSupply (for backward compatibility)
    const totalSupplyNum = this.getSupplyForCalculation(config);
    
    // Match backend formula: base_bp = 0.000000001, reference_supply = 1_000_000_000 (1 billion)
    // Backend: bp = base_bp * (reference_supply / total_supply_human).min(1.0)
    const referenceSupply = 1_000_000_000.0; // 1 billion (matches backend)
    const baseBp = 0.000000001; // Matches backend base_bp
    
    // Calculate supply scale (same as backend)
    const supplyScale = Math.min(referenceSupply / Math.max(1, totalSupplyNum), 1.0);
    const basePrice = baseBp * supplyScale;
    
    // Ensure minimum price (matches backend minimum)
    return Math.max(0.0000000000001, basePrice);
  }

  /**
   * Calculate current price based on tokens sold
   * P(x) = a * x + b
   */
  calculatePrice(
    tokensSold: number,
    config: BondingCurveConfig
  ): number {
    // Use calculateInitialPrice to get properly scaled base price
    const basePrice = config.basePrice !== undefined 
      ? config.basePrice 
      : this.calculateInitialPrice(config);
    const totalSupplyNum = this.getSupplyForCalculation(config);
    const slope = config.slope || this.calculateSlopeFromSupply(totalSupplyNum);
    
    if (config.curveType === 'linear') {
      // Linear bonding curve: P(x) = a * x + b
      return slope * tokensSold + basePrice;
    } else {
      // Exponential bonding curve: P(x) = b * (1 + r)^x
      // Simplified to linear for now, can be enhanced later
      const growthRate = slope / 100; // Convert to growth rate
      return basePrice * Math.pow(1 + growthRate, tokensSold / 1000);
    }
  }

  /**
   * Calculate slope parameter based on total supply
   * Matches backend formula: base_pi = 0.000000001, reference_supply = 1_000_000_000
   */
  private calculateSlopeFromSupply(totalSupply: number): number {
    if (totalSupply <= 0) return 0.0000000000001;
    
    // Match backend: base_pi = 0.000000001, reference_supply = 1_000_000_000
    const referenceSupply = 1_000_000_000.0; // 1 billion (matches backend)
    const basePi = 0.000000001; // Matches backend base_pi
    
    // Calculate supply scale (same as backend)
    const supplyScale = Math.min(referenceSupply / Math.max(1, totalSupply), 1.0);
    const slope = basePi * supplyScale;
    
    // Ensure minimum (matches backend)
    return Math.max(0.0000000000001, slope);
  }

  /**
   * Calculate tokens received for a given SOL amount
   * Uses integration of the bonding curve
   * Updated to handle large supplies safely with overflow protection
   */
  calculateTokensForSol(
    solAmount: number,
    currentTokensSold: number | bigint,
    config: BondingCurveConfig
  ): number {
    const totalSupplyNum = this.getSupplyForCalculation(config);
    const tokensSoldNum = typeof currentTokensSold === 'bigint' 
      ? Number(currentTokensSold) 
      : currentTokensSold;
    
    const slope = config.slope || this.calculateSlopeFromSupply(totalSupplyNum);
    const basePrice = config.basePrice !== undefined 
      ? config.basePrice 
      : this.calculateInitialPrice(config);
    
    if (config.curveType === 'linear') {
      // Match backend EXACTLY:
      // Formula: PI*x1^2 + 2*BP*x1 - C = 0
      // Where C = 2*SOL + PI*x0^2 + 2*BP*x0
      // Solution: x1 = (-2*BP + sqrt((2*BP)^2 + 4*PI*C)) / (2*PI)
      const pi = slope;  // PI = price increase per token
      const bp = basePrice;  // BP = base price
      const x0 = tokensSoldNum;  // Current tokens sold (human-readable)
      
      // Calculate C = 2*SOL + PI*x0^2 + 2*BP*x0
      const c = 2.0 * solAmount + pi * x0 * x0 + 2.0 * bp * x0;
      
      // Calculate discriminant = (2*BP)^2 + 4*PI*C
      const discriminant = (2.0 * bp) * (2.0 * bp) + 4.0 * pi * c;
      
      // Check for invalid discriminant
      if (discriminant < 0 || !isFinite(discriminant) || isNaN(discriminant)) {
        console.warn('⚠️ Invalid discriminant in bonding curve calculation:', discriminant);
        return 0;
      }
      
      const sqrt_d = Math.sqrt(discriminant);
      if (!isFinite(sqrt_d) || isNaN(sqrt_d)) {
        console.warn('⚠️ Invalid sqrt in bonding curve calculation:', sqrt_d);
        return 0;
      }
      
      // Calculate x1 = (-2*BP + sqrt(discriminant)) / (2*PI)
      const x1 = (-2.0 * bp + sqrt_d) / (2.0 * pi);
      const newTokens = Math.max(0, x1 - x0);
      
      // Clamp to prevent overflow
      return clampToU64(newTokens);
    } else {
      // Exponential curve - simplified calculation
      const currentPrice = this.calculatePrice(tokensSoldNum, config);
      if (currentPrice <= 0) return 0;
      return clampToU64(solAmount / currentPrice);
    }
  }
  
  /**
   * Format tokens for display (with proper large number formatting)
   */
  formatTokens(tokens: number | bigint, decimals: number = 9): string {
    return formatTokenAmount(tokens, decimals);
  }
  
  /**
   * Format price for display
   */
  formatPrice(price: number): string {
    if (price < 0.000001) {
      return price.toFixed(12);
    } else if (price < 0.01) {
      return price.toFixed(8);
    } else if (price < 1) {
      return price.toFixed(6);
    } else {
      return price.toFixed(4);
    }
  }

  /**
   * Calculate SOL received for selling tokens
   */
  calculateSolForTokens(
    tokensAmount: number,
    currentTokensSold: number,
    config: BondingCurveConfig
  ): number {
    if (config.curveType === 'linear') {
      const totalSupplyNum = this.getSupplyForCalculation(config);
      const slope = config.slope || this.calculateSlopeFromSupply(totalSupplyNum);
      const basePrice = config.basePrice !== undefined 
        ? config.basePrice 
        : this.calculateInitialPrice(config);
      
      // For selling, we calculate the average price over the range
      const priceBefore = this.calculatePrice(currentTokensSold, config);
      const priceAfter = this.calculatePrice(Math.max(0, currentTokensSold - tokensAmount), config);
      
      // Average price
      const avgPrice = (priceBefore + priceAfter) / 2;
      return tokensAmount * avgPrice;
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
    const totalSupplyNum = this.getSupplyForCalculation(config);
    const slope = config.slope || this.calculateSlopeFromSupply(totalSupplyNum);
    const basePrice = config.basePrice !== undefined 
      ? config.basePrice 
      : this.calculateInitialPrice(config);
    const initialPrice = basePrice;
    
    return {
      initialPrice,
      slope,
      basePrice,
      priceAt50Percent: this.calculatePrice(totalSupplyNum * 0.5, config),
      priceAt100Percent: this.calculatePrice(totalSupplyNum, config),
    };
  }
}

export const bondingCurveService = new BondingCurveService();

