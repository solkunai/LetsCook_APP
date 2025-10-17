/**
 * Pump.fun Fee Structure Reference
 * 
 * This file provides a reference implementation of pump.fun's fee structure
 * for comparison with Let's Cook platform fees.
 */

export interface PumpFunFeeStructure {
  // Trading fees
  buyFee: number;           // Fee for buying tokens
  sellFee: number;          // Fee for selling tokens
  
  // Launch fees
  launchFee: number;        // Fee to launch a token
  
  // Bonding curve parameters
  bondingCurveFee: number;  // Fee applied to bonding curve trades
  
  // Platform fees
  platformFee: number;      // Platform's cut of trading fees
  
  // Creator fees
  creatorFee: number;       // Fee paid to token creator
  
  // Additional fees
  metadataFee?: number;     // Fee for metadata updates
  transferFee?: number;     // Fee for token transfers
}

export interface LetsCookFeeStructure {
  // Trading fees
  swapFee: number;          // Fee for swaps on CookDEX
  
  // Launch fees
  instantLaunchFee: number; // Fee for instant launches
  raffleLaunchFee: number;  // Fee for raffle launches
  
  // Platform fees
  platformFee: number;      // Platform's cut
  
  // Additional fees
  transactionFee: number;   // Base transaction fee
}

/**
 * Pump.fun's typical fee structure (as of 2024)
 * Based on public information and community reports
 */
export const PUMP_FUN_FEES: PumpFunFeeStructure = {
  // Trading fees - typically around 1% total
  buyFee: 0.01,            // 1% buy fee
  sellFee: 0.01,           // 1% sell fee
  
  // Launch fees
  launchFee: 0.002,         // ~0.002 SOL launch fee
  
  // Bonding curve fees
  bondingCurveFee: 0.01,   // 1% bonding curve fee
  
  // Platform fees
  platformFee: 0.005,      // 0.5% platform fee
  
  // Creator fees
  creatorFee: 0.005,       // 0.5% creator fee
  
  // Additional fees
  metadataFee: 0.001,      // 0.001 SOL for metadata updates
  transferFee: 0.0001,      // 0.0001 SOL transfer fee
};

/**
 * Let's Cook platform fee structure
 * Current implementation
 */
export const LETS_COOK_FEES: LetsCookFeeStructure = {
  // Trading fees
  swapFee: 0.0025,         // 0.25% swap fee on CookDEX
  
  // Launch fees
  instantLaunchFee: 0.005, // 0.005 SOL instant launch fee
  raffleLaunchFee: 0.0,    // No fee for raffle launches
  
  // Platform fees
  platformFee: 0.001,      // 0.1% platform fee
  
  // Additional fees
  transactionFee: 0.0005,  // Base transaction fee
};

/**
 * Fee comparison utilities
 */
export class FeeComparisonService {
  /**
   * Compare total trading fees between platforms
   */
  static compareTradingFees(): {
    pumpFun: number;
    letsCook: number;
    difference: number;
    percentageDifference: number;
  } {
    const pumpFunTotal = PUMP_FUN_FEES.buyFee + PUMP_FUN_FEES.sellFee;
    const letsCookTotal = LETS_COOK_FEES.swapFee * 2; // Assuming same fee for buy/sell
    
    return {
      pumpFun: pumpFunTotal,
      letsCook: letsCookTotal,
      difference: letsCookTotal - pumpFunTotal,
      percentageDifference: ((letsCookTotal - pumpFunTotal) / pumpFunTotal) * 100
    };
  }

  /**
   * Compare launch fees between platforms
   */
  static compareLaunchFees(): {
    pumpFun: number;
    letsCookInstant: number;
    letsCookRaffle: number;
    instantDifference: number;
    raffleDifference: number;
  } {
    return {
      pumpFun: PUMP_FUN_FEES.launchFee,
      letsCookInstant: LETS_COOK_FEES.instantLaunchFee,
      letsCookRaffle: LETS_COOK_FEES.raffleLaunchFee,
      instantDifference: LETS_COOK_FEES.instantLaunchFee - PUMP_FUN_FEES.launchFee,
      raffleDifference: LETS_COOK_FEES.raffleLaunchFee - PUMP_FUN_FEES.launchFee
    };
  }

  /**
   * Calculate total cost for a $100 trade
   */
  static calculateTradeCost(amount: number = 100): {
    pumpFun: number;
    letsCook: number;
    savings: number;
  } {
    const pumpFunCost = amount * (PUMP_FUN_FEES.buyFee + PUMP_FUN_FEES.sellFee);
    const letsCookCost = amount * (LETS_COOK_FEES.swapFee * 2);
    
    return {
      pumpFun: pumpFunCost,
      letsCook: letsCookCost,
      savings: pumpFunCost - letsCookCost
    };
  }

  /**
   * Get fee structure summary
   */
  static getFeeSummary(): {
    pumpFun: {
      totalTradingFee: number;
      launchFee: number;
      platformFee: number;
      creatorFee: number;
    };
    letsCook: {
      totalTradingFee: number;
      instantLaunchFee: number;
      raffleLaunchFee: number;
      platformFee: number;
    };
  } {
    return {
      pumpFun: {
        totalTradingFee: PUMP_FUN_FEES.buyFee + PUMP_FUN_FEES.sellFee,
        launchFee: PUMP_FUN_FEES.launchFee,
        platformFee: PUMP_FUN_FEES.platformFee,
        creatorFee: PUMP_FUN_FEES.creatorFee
      },
      letsCook: {
        totalTradingFee: LETS_COOK_FEES.swapFee * 2,
        instantLaunchFee: LETS_COOK_FEES.instantLaunchFee,
        raffleLaunchFee: LETS_COOK_FEES.raffleLaunchFee,
        platformFee: LETS_COOK_FEES.platformFee
      }
    };
  }
}

/**
 * Pump.fun bonding curve implementation reference
 * This shows how pump.fun's bonding curve works
 */
export class PumpFunBondingCurve {
  private static readonly INITIAL_PRICE = 0.000001; // Starting price
  private static readonly PRICE_INCREMENT = 0.000001; // Price increment per token
  
  /**
   * Calculate price based on tokens sold
   */
  static calculatePrice(tokensSold: number): number {
    return this.INITIAL_PRICE + (tokensSold * this.PRICE_INCREMENT);
  }
  
  /**
   * Calculate tokens received for SOL amount
   */
  static calculateTokensReceived(solAmount: number, tokensSold: number): number {
    const currentPrice = this.calculatePrice(tokensSold);
    const feeAmount = solAmount * PUMP_FUN_FEES.buyFee;
    const netAmount = solAmount - feeAmount;
    
    return Math.floor(netAmount / currentPrice);
  }
  
  /**
   * Calculate SOL received for token amount
   */
  static calculateSolReceived(tokenAmount: number, tokensSold: number): number {
    const currentPrice = this.calculatePrice(tokensSold);
    const grossAmount = tokenAmount * currentPrice;
    const feeAmount = grossAmount * PUMP_FUN_FEES.sellFee;
    
    return grossAmount - feeAmount;
  }
}

/**
 * Integration suggestions for Let's Cook platform
 */
export class PumpFunIntegrationSuggestions {
  /**
   * Suggested improvements based on pump.fun's model
   */
  static getSuggestions(): string[] {
    return [
      "Consider implementing a bonding curve model for instant launches",
      "Add creator fee sharing mechanism similar to pump.fun",
      "Implement dynamic pricing based on token supply",
      "Add metadata update fees to prevent spam",
      "Consider implementing transfer fees for large transactions",
      "Add platform fee sharing with token creators",
      "Implement progressive fee structure based on trading volume"
    ];
  }
  
  /**
   * Competitive advantages of Let's Cook
   */
  static getCompetitiveAdvantages(): string[] {
    return [
      "Lower trading fees (0.25% vs 1%)",
      "Free raffle launches vs paid launches",
      "No initial liquidity required for instant launches",
      "Transparent tokenomics display",
      "Community voting system",
      "Custom referral codes",
      "Banner support for raffle pages"
    ];
  }
}

export default {
  PUMP_FUN_FEES,
  LETS_COOK_FEES,
  FeeComparisonService,
  PumpFunBondingCurve,
  PumpFunIntegrationSuggestions
};
