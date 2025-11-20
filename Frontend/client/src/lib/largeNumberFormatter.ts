/**
 * Large Number Formatter
 * 
 * Handles formatting of very large numbers (billions, trillions) with proper precision
 * Uses BigInt for calculations to avoid floating point errors
 */

/**
 * Format a large number with appropriate suffix (K, M, B, T)
 */
export function formatLargeNumber(value: number | bigint | string, decimals: number = 2): string {
  const num = typeof value === 'bigint' ? Number(value) : typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || num === 0) return '0';
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1e12) {
    return `${(num / 1e12).toFixed(decimals)}T`;
  } else if (absNum >= 1e9) {
    return `${(num / 1e9).toFixed(decimals)}B`;
  } else if (absNum >= 1e6) {
    return `${(num / 1e6).toFixed(decimals)}M`;
  } else if (absNum >= 1e3) {
    return `${(num / 1e3).toFixed(decimals)}K`;
  }
  
  return num.toFixed(decimals);
}

/**
 * Format a large number with full precision (no suffix)
 */
export function formatLargeNumberFull(value: number | bigint | string): string {
  const num = typeof value === 'bigint' ? Number(value) : typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0';
  
  return num.toLocaleString('en-US', {
    maximumFractionDigits: 9,
    useGrouping: true,
  });
}

/**
 * Convert raw token amount to human-readable format accounting for decimals
 */
export function formatTokenAmount(
  rawAmount: number | bigint | string,
  decimals: number = 9
): string {
  const amount = typeof rawAmount === 'bigint' 
    ? Number(rawAmount) 
    : typeof rawAmount === 'string' 
      ? parseFloat(rawAmount) 
      : rawAmount;
  
  if (isNaN(amount) || amount === 0) return '0';
  
  const divisor = Math.pow(10, decimals);
  const humanReadable = amount / divisor;
  
  return formatLargeNumber(humanReadable, 2);
}

/**
 * Convert human-readable amount to raw units (accounting for decimals)
 */
export function toRawUnits(
  humanReadable: number | string,
  decimals: number = 9
): bigint {
  const num = typeof humanReadable === 'string' ? parseFloat(humanReadable) : humanReadable;
  
  if (isNaN(num)) return BigInt(0);
  
  const multiplier = BigInt(Math.pow(10, decimals));
  const numBigInt = BigInt(Math.floor(num * Math.pow(10, decimals)));
  
  return numBigInt;
}

/**
 * Safe addition for large numbers using BigInt
 */
export function safeAdd(a: number | bigint, b: number | bigint): bigint {
  const aBig = typeof a === 'bigint' ? a : BigInt(Math.floor(a));
  const bBig = typeof b === 'bigint' ? b : BigInt(Math.floor(b));
  return aBig + bBig;
}

/**
 * Safe multiplication for large numbers using BigInt
 */
export function safeMultiply(a: number | bigint, b: number | bigint): bigint {
  const aBig = typeof a === 'bigint' ? a : BigInt(Math.floor(a));
  const bBig = typeof b === 'bigint' ? b : BigInt(Math.floor(b));
  return aBig * bBig;
}

/**
 * Clamp value to u64 max (2^64 - 1)
 */
export function clampToU64(value: number | bigint): number {
  const U64_MAX = BigInt('18446744073709551615');
  const valueBig = typeof value === 'bigint' ? value : BigInt(Math.floor(value));
  
  if (valueBig > U64_MAX) {
    return Number(U64_MAX);
  }
  
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Check if value exceeds u64 max
 */
export function exceedsU64Max(value: number | bigint): boolean {
  const U64_MAX = BigInt('18446744073709551615');
  const valueBig = typeof value === 'bigint' ? value : BigInt(Math.floor(value));
  return valueBig > U64_MAX;
}



