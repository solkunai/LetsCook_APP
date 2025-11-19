/**
 * Starting Price Reference Guide
 * 
 * This document shows the starting prices for token launches based on total supply.
 * Prices are calculated using the bonding curve formula and scale inversely with supply.
 */

import { bondingCurveService } from './bondingCurveService';
import { formatLargeNumber } from './largeNumberFormatter';

export interface StartingPriceInfo {
  supply: number;
  supplyFormatted: string;
  startingPrice: number;
  startingPriceFormatted: string;
  priceInUSD: number; // Assuming $150/SOL
  tokensFor1SOL: number;
  tokensFor10SOL: number;
  tokensFor100SOL: number;
}

/**
 * Calculate starting price for a given supply
 */
export function getStartingPrice(totalSupply: number, decimals: number = 9): StartingPriceInfo {
  const config = {
    totalSupply,
    decimals,
    curveType: 'linear' as const,
  };
  
  const startingPrice = bondingCurveService.calculateInitialPrice(config);
  const tokensFor1SOL = bondingCurveService.calculateTokensForSol(1.0, 0, config);
  const tokensFor10SOL = bondingCurveService.calculateTokensForSol(10.0, 0, config);
  const tokensFor100SOL = bondingCurveService.calculateTokensForSol(100.0, 0, config);
  
  // Assuming SOL price of $150 (adjust as needed)
  const SOL_PRICE_USD = 150;
  const priceInUSD = startingPrice * SOL_PRICE_USD;
  
  return {
    supply: totalSupply,
    supplyFormatted: formatLargeNumber(totalSupply),
    startingPrice,
    startingPriceFormatted: startingPrice < 0.000001 
      ? startingPrice.toFixed(12) 
      : startingPrice.toFixed(8),
    priceInUSD,
    tokensFor1SOL,
    tokensFor10SOL,
    tokensFor100SOL,
  };
}

/**
 * Get starting prices for common supply sizes
 */
export function getStartingPricesReference(): Record<string, StartingPriceInfo> {
  return {
    '1M': getStartingPrice(1_000_000, 9),
    '10M': getStartingPrice(10_000_000, 9),
    '100M': getStartingPrice(100_000_000, 9),
    '1B': getStartingPrice(1_000_000_000, 9),
    '10B': getStartingPrice(10_000_000_000, 9),
    '100B': getStartingPrice(100_000_000_000, 9),
    '1T': getStartingPrice(1_000_000_000_000, 9),
  };
}

/**
 * Display starting prices reference table
 */
export function displayStartingPricesTable(): void {
  const prices = getStartingPricesReference();
  
  console.log('\n📊 Starting Prices Reference Table\n');
  console.log('Supply Size | Starting Price (SOL) | Price (USD) | Tokens for 1 SOL');
  console.log('------------|---------------------|------------|-----------------');
  
  Object.entries(prices).forEach(([key, info]) => {
    const priceDisplay = info.startingPrice < 0.000001 
      ? info.startingPrice.toExponential(3)
      : info.startingPrice.toFixed(8);
    const tokensDisplay = formatLargeNumber(info.tokensFor1SOL);
    
    console.log(
      `${info.supplyFormatted.padEnd(10)} | ${priceDisplay.padStart(19)} | $${info.priceInUSD.toFixed(10).padStart(10)} | ${tokensDisplay.padStart(15)}`
    );
  });
  
  console.log('\n💡 Notes:');
  console.log('- Prices scale inversely with supply (higher supply = lower price)');
  console.log('- USD prices assume SOL = $150 (adjust as needed)');
  console.log('- Prices increase as tokens are bought (bonding curve)');
  console.log('- Minimum price floor: 0.0000000001 SOL per token\n');
}

/**
 * Calculate starting price for custom supply
 */
export function calculateCustomStartingPrice(
  totalSupply: number,
  decimals: number = 9
): string {
  const info = getStartingPrice(totalSupply, decimals);
  
  return `
📊 Starting Price Calculation:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Supply:              ${info.supplyFormatted} tokens
Starting Price:      ${info.startingPriceFormatted} SOL per token
Price in USD:        $${info.priceInUSD.toFixed(12)} per token (assuming $150/SOL)

Tokens Received:
  • 1 SOL:           ${formatLargeNumber(info.tokensFor1SOL)} tokens
  • 10 SOL:          ${formatLargeNumber(info.tokensFor10SOL)} tokens
  • 100 SOL:         ${formatLargeNumber(info.tokensFor100SOL)} tokens

💡 Price increases as more tokens are bought (bonding curve effect)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}

// Export for browser console access
if (typeof window !== 'undefined') {
  (window as any).startingPrices = {
    getStartingPrice,
    getStartingPricesReference,
    displayStartingPricesTable,
    calculateCustomStartingPrice,
  };
}


