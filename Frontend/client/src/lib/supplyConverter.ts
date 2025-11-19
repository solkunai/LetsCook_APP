/**
 * Supply Converter Utility
 * 
 * Implements "virtual supply" + "real raw supply" system to prevent u64 overflow
 * while allowing users to enter any supply amount they want.
 * 
 * This is the same approach used by pump.fun and other major launchpads.
 */

// u64::MAX = 18,446,744,073,709,551,615
const U64_MAX = BigInt('18446744073709551615');

export interface SupplyConversionResult {
  /** The real supply that will be minted (safe for u64) */
  realSupply: number;
  /** The virtual supply (what the user entered) */
  virtualSupply: number;
  /** The scale factor applied (1.0 if no scaling needed) */
  scaleFactor: number;
  /** Whether scaling was applied */
  wasScaled: boolean;
  /** Raw units (realSupply * 10^decimals) - guaranteed to fit in u64 */
  rawUnits: bigint;
}

/**
 * Converts a virtual supply (user input) to a real supply that fits in u64
 * 
 * @param virtualSupply - The supply the user wants (can be any number)
 * @param decimals - Token decimals (0-9)
 * @returns Conversion result with real supply and scale factor
 */
export function convertToRealSupply(
  virtualSupply: number,
  decimals: number
): SupplyConversionResult {
  // Validate inputs
  if (virtualSupply <= 0) {
    throw new Error('Virtual supply must be greater than 0');
  }
  if (decimals < 0 || decimals > 9) {
    throw new Error('Decimals must be between 0 and 9');
  }

  // Calculate raw units for virtual supply
  const decimalsMultiplier = BigInt(10 ** decimals);
  const virtualRawUnits = BigInt(Math.floor(virtualSupply)) * decimalsMultiplier;

  // Check if it fits in u64
  if (virtualRawUnits <= U64_MAX) {
    // No scaling needed
    return {
      realSupply: Math.floor(virtualSupply),
      virtualSupply: Math.floor(virtualSupply),
      scaleFactor: 1.0,
      wasScaled: false,
      rawUnits: virtualRawUnits,
    };
  }

  // Calculate scale factor
  // scale_factor = virtual_raw_units / u64_max
  const scaleFactorBigInt = (virtualRawUnits * BigInt(1000000)) / U64_MAX; // Use 1e6 precision
  const scaleFactor = Number(scaleFactorBigInt) / 1000000;

  // Calculate real supply
  // real_supply = virtual_supply / scale_factor
  const realSupply = Math.floor(virtualSupply / scaleFactor);

  // Verify real supply fits in u64
  const realRawUnits = BigInt(realSupply) * decimalsMultiplier;
  if (realRawUnits > U64_MAX) {
    // Safety check: if still too large, use maximum safe supply
    const maxSafeSupply = Number(U64_MAX / decimalsMultiplier);
    return {
      realSupply: Math.floor(maxSafeSupply),
      virtualSupply: Math.floor(virtualSupply),
      scaleFactor: virtualSupply / Math.floor(maxSafeSupply),
      wasScaled: true,
      rawUnits: BigInt(Math.floor(maxSafeSupply)) * decimalsMultiplier,
    };
  }

  return {
    realSupply,
    virtualSupply: Math.floor(virtualSupply),
    scaleFactor,
    wasScaled: true,
    rawUnits: realRawUnits,
  };
}

/**
 * Gets the maximum safe supply for given decimals (without scaling)
 * 
 * @param decimals - Token decimals (0-9)
 * @returns Maximum supply that fits in u64 without scaling
 */
export function getMaxSafeSupply(decimals: number): number {
  if (decimals < 0 || decimals > 9) {
    throw new Error('Decimals must be between 0 and 9');
  }
  const decimalsMultiplier = BigInt(10 ** decimals);
  const maxSupply = Number(U64_MAX / decimalsMultiplier);
  return Math.floor(maxSupply);
}

/**
 * Formats supply for display (shows virtual supply to user)
 * 
 * @param supply - Supply to format
 * @returns Formatted string (e.g., "1.5T", "500B", "1M")
 */
export function formatSupply(supply: number): string {
  if (supply >= 1e15) {
    return `${(supply / 1e15).toFixed(2)}Q`; // Quadrillion
  }
  if (supply >= 1e12) {
    return `${(supply / 1e12).toFixed(2)}T`; // Trillion
  }
  if (supply >= 1e9) {
    return `${(supply / 1e9).toFixed(2)}B`; // Billion
  }
  if (supply >= 1e6) {
    return `${(supply / 1e6).toFixed(2)}M`; // Million
  }
  if (supply >= 1e3) {
    return `${(supply / 1e3).toFixed(2)}K`; // Thousand
  }
  return supply.toLocaleString();
}


