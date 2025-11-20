/**
 * Bonding Curve Test Utilities
 * 
 * Test utilities for validating bonding curve behavior with various supply sizes
 */

import { bondingCurveService } from './bondingCurveService';
import { formatLargeNumber, formatTokenAmount } from './largeNumberFormatter';
import type { BondingCurveConfig } from './bondingCurveService';

export interface TestResult {
  supply: string;
  decimals: number;
  initialPrice: number;
  priceAt10Percent: number;
  priceAt50Percent: number;
  priceAt100Percent: number;
  tokensFor1SOL: number;
  tokensFor10SOL: number;
  tokensFor100SOL: number;
  formattedSupply: string;
  formattedTokens1SOL: string;
  formattedTokens10SOL: string;
  formattedTokens100SOL: string;
}

/**
 * Test bonding curve with a specific supply size
 */
export function testBondingCurve(
  totalSupply: number,
  decimals: number = 9
): TestResult {
  const config: BondingCurveConfig = {
    totalSupply,
    decimals,
    curveType: 'linear',
  };
  
  const initialPrice = bondingCurveService.calculateInitialPrice(config);
  const priceAt10Percent = bondingCurveService.calculatePrice(
    totalSupply * 0.1,
    config
  );
  const priceAt50Percent = bondingCurveService.calculatePrice(
    totalSupply * 0.5,
    config
  );
  const priceAt100Percent = bondingCurveService.calculatePrice(
    totalSupply,
    config
  );
  
  // Test with 1 SOL, 10 SOL, 100 SOL
  const tokensFor1SOL = bondingCurveService.calculateTokensForSol(
    1.0,
    0,
    config
  );
  const tokensFor10SOL = bondingCurveService.calculateTokensForSol(
    10.0,
    0,
    config
  );
  const tokensFor100SOL = bondingCurveService.calculateTokensForSol(
    100.0,
    0,
    config
  );
  
  return {
    supply: formatLargeNumber(totalSupply),
    decimals,
    initialPrice,
    priceAt10Percent,
    priceAt50Percent,
    priceAt100Percent,
    tokensFor1SOL,
    tokensFor10SOL,
    tokensFor100SOL,
    formattedSupply: formatLargeNumber(totalSupply),
    formattedTokens1SOL: formatTokenAmount(tokensFor1SOL, decimals),
    formattedTokens10SOL: formatTokenAmount(tokensFor10SOL, decimals),
    formattedTokens100SOL: formatTokenAmount(tokensFor100SOL, decimals),
  };
}

/**
 * Run comprehensive test suite for various supply sizes
 */
export function runBondingCurveTests(): {
  test1B: TestResult;
  test10B: TestResult;
  test100B: TestResult;
  test1T: TestResult;
} {
  console.log('🧪 Running Bonding Curve Tests...\n');
  
  const test1B = testBondingCurve(1_000_000_000, 9);
  const test10B = testBondingCurve(10_000_000_000, 9);
  const test100B = testBondingCurve(100_000_000_000, 9);
  const test1T = testBondingCurve(1_000_000_000_000, 9);
  
  console.log('📊 Test Results:');
  console.log('\n1 Billion Supply:');
  console.log(`  Initial Price: ${test1B.initialPrice.toFixed(12)} SOL`);
  console.log(`  Price at 10%: ${test1B.priceAt10Percent.toFixed(12)} SOL`);
  console.log(`  Price at 50%: ${test1B.priceAt50Percent.toFixed(12)} SOL`);
  console.log(`  Tokens for 1 SOL: ${test1B.formattedTokens1SOL}`);
  console.log(`  Tokens for 10 SOL: ${test1B.formattedTokens10SOL}`);
  
  console.log('\n10 Billion Supply:');
  console.log(`  Initial Price: ${test10B.initialPrice.toFixed(12)} SOL`);
  console.log(`  Price at 10%: ${test10B.priceAt10Percent.toFixed(12)} SOL`);
  console.log(`  Tokens for 1 SOL: ${test10B.formattedTokens1SOL}`);
  
  console.log('\n100 Billion Supply:');
  console.log(`  Initial Price: ${test100B.initialPrice.toFixed(12)} SOL`);
  console.log(`  Price at 10%: ${test100B.priceAt10Percent.toFixed(12)} SOL`);
  console.log(`  Tokens for 1 SOL: ${test100B.formattedTokens1SOL}`);
  
  console.log('\n1 Trillion Supply:');
  console.log(`  Initial Price: ${test1T.initialPrice.toFixed(12)} SOL`);
  console.log(`  Price at 10%: ${test1T.priceAt10Percent.toFixed(12)} SOL`);
  console.log(`  Tokens for 1 SOL: ${test1T.formattedTokens1SOL}`);
  
  return {
    test1B,
    test10B,
    test100B,
    test1T,
  };
}

/**
 * Validate price scaling across different supplies
 */
export function validatePriceScaling(): boolean {
  console.log('\n🔍 Validating Price Scaling...\n');
  
  const supplies = [
    1_000_000_000,      // 1B
    10_000_000_000,     // 10B
    100_000_000_000,    // 100B
    1_000_000_000_000,  // 1T
  ];
  
  const initialPrices: number[] = [];
  
  for (const supply of supplies) {
    const config: BondingCurveConfig = {
      totalSupply: supply,
      decimals: 9,
      curveType: 'linear',
    };
    const price = bondingCurveService.calculateInitialPrice(config);
    initialPrices.push(price);
    console.log(`Supply: ${formatLargeNumber(supply)}, Initial Price: ${price.toFixed(12)} SOL`);
  }
  
  // Validate that prices scale inversely with supply
  // 10B should have 10x lower price than 1B
  // 100B should have 100x lower price than 1B
  const ratio1Bto10B = initialPrices[0] / initialPrices[1];
  const ratio1Bto100B = initialPrices[0] / initialPrices[2];
  const ratio1Bto1T = initialPrices[0] / initialPrices[3];
  
  console.log(`\nPrice Ratios:`);
  console.log(`  1B / 10B: ${ratio1Bto10B.toFixed(2)} (expected ~10)`);
  console.log(`  1B / 100B: ${ratio1Bto100B.toFixed(2)} (expected ~100)`);
  console.log(`  1B / 1T: ${ratio1Bto1T.toFixed(2)} (expected ~1000)`);
  
  const isValid = 
    ratio1Bto10B >= 9.0 && ratio1Bto10B <= 11.0 &&
    ratio1Bto100B >= 90.0 && ratio1Bto100B <= 110.0 &&
    ratio1Bto1T >= 900.0 && ratio1Bto1T <= 1100.0;
  
  if (isValid) {
    console.log('\n✅ Price scaling validation PASSED');
  } else {
    console.log('\n❌ Price scaling validation FAILED');
  }
  
  return isValid;
}

// Export for use in browser console or tests
if (typeof window !== 'undefined') {
  (window as any).bondingCurveTests = {
    testBondingCurve,
    runBondingCurveTests,
    validatePriceScaling,
  };
}



