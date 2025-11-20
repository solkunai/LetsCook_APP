use solana_program::program_error::ProgramError;
use solana_program::msg;

/// u64::MAX = 18,446,744,073,709,551,615
const U64_MAX: u64 = 18_446_744_073_709_551_615u64;

/// Result of supply conversion
pub struct SupplyConversionResult {
    /// The real supply that will be minted (safe for u64)
    pub real_supply: u64,
    /// The virtual supply (what the user entered)
    pub virtual_supply: u64,
    /// The scale factor applied (1.0 if no scaling needed, represented as u64 with 6 decimal places)
    /// scale_factor = (virtual_supply * 10^decimals) / u64_max * 1_000_000
    pub scale_factor_millions: u64,
    /// Whether scaling was applied
    pub was_scaled: bool,
    /// Raw units (real_supply * 10^decimals) - guaranteed to fit in u64
    pub raw_units: u64,
}

/// Converts a virtual supply (user input) to a real supply that fits in u64
/// 
/// This implements the "virtual supply" + "real raw supply" system used by
/// pump.fun and other major launchpads to prevent u64 overflow while allowing
/// users to enter any supply amount they want.
/// 
/// # Arguments
/// * `virtual_supply` - The supply the user wants (can be any number)
/// * `decimals` - Token decimals (0-9)
/// 
/// # Returns
/// * `SupplyConversionResult` - Contains real supply, scale factor, and raw units
/// 
/// # Errors
/// * `ProgramError::InvalidArgument` - If virtual_supply is 0 or decimals is invalid
pub fn convert_to_real_supply(
    virtual_supply: u64,
    decimals: u8,
) -> Result<SupplyConversionResult, ProgramError> {
    // Validate inputs
    if virtual_supply == 0 {
        msg!("❌ ERROR: Virtual supply must be greater than 0");
        return Err(ProgramError::InvalidArgument);
    }
    if decimals > 9 {
        msg!("❌ ERROR: Decimals must be between 0 and 9, got: {}", decimals);
        return Err(ProgramError::InvalidArgument);
    }

    // Calculate raw units for virtual supply
    let decimals_multiplier = 10u64.pow(decimals as u32);
    
    // Check for overflow before multiplication
    let virtual_raw_units = virtual_supply.checked_mul(decimals_multiplier).ok_or_else(|| {
        msg!("❌ ERROR: Overflow calculating virtual_raw_units");
        msg!("  virtual_supply: {}", virtual_supply);
        msg!("  decimals_multiplier: {}", decimals_multiplier);
        ProgramError::InvalidArgument
    })?;

    // Check if it fits in u64
    if virtual_raw_units <= U64_MAX {
        // No scaling needed
        msg!("✅ No scaling needed: virtual_supply={}, raw_units={} (fits in u64)", 
             virtual_supply, virtual_raw_units);
        return Ok(SupplyConversionResult {
            real_supply: virtual_supply,
            virtual_supply,
            scale_factor_millions: 1_000_000, // 1.0 represented as 1_000_000
            was_scaled: false,
            raw_units: virtual_raw_units,
        });
    }

    // Calculate scale factor
    // scale_factor = virtual_raw_units / u64_max
    // We use fixed-point arithmetic with 6 decimal places (millions)
    // scale_factor_millions = (virtual_raw_units * 1_000_000) / u64_max
    let scale_factor_millions = (virtual_raw_units as u128)
        .checked_mul(1_000_000)
        .and_then(|x| x.checked_div(U64_MAX as u128))
        .ok_or_else(|| {
            msg!("❌ ERROR: Overflow calculating scale_factor");
            ProgramError::InvalidArgument
        })? as u64;

    // Calculate real supply
    // real_supply = virtual_supply / scale_factor
    // real_supply = (virtual_supply * 1_000_000) / scale_factor_millions
    let real_supply = (virtual_supply as u128)
        .checked_mul(1_000_000)
        .and_then(|x| x.checked_div(scale_factor_millions as u128))
        .ok_or_else(|| {
            msg!("❌ ERROR: Overflow calculating real_supply");
            ProgramError::InvalidArgument
        })? as u64;

    // Verify real supply fits in u64
    let real_raw_units = real_supply.checked_mul(decimals_multiplier).ok_or_else(|| {
        msg!("❌ ERROR: Overflow calculating real_raw_units");
        ProgramError::InvalidArgument
    })?;

    if real_raw_units > U64_MAX {
        // Safety check: if still too large, use maximum safe supply
        let max_safe_supply = U64_MAX / decimals_multiplier;
        let final_raw_units = max_safe_supply * decimals_multiplier;
        
        // Recalculate scale factor for max safe supply
        let final_scale_factor_millions = (final_raw_units as u128)
            .checked_mul(1_000_000)
            .and_then(|x| x.checked_div(U64_MAX as u128))
            .ok_or_else(|| {
                msg!("❌ ERROR: Overflow calculating final scale_factor");
                ProgramError::InvalidArgument
            })? as u64;

        msg!("⚠️ WARNING: Virtual supply too large, using maximum safe supply");
        msg!("  virtual_supply: {}", virtual_supply);
        msg!("  max_safe_supply: {}", max_safe_supply);
        msg!("  scale_factor: {:.6}", final_scale_factor_millions as f64 / 1_000_000.0);
        
        return Ok(SupplyConversionResult {
            real_supply: max_safe_supply,
            virtual_supply,
            scale_factor_millions: final_scale_factor_millions,
            was_scaled: true,
            raw_units: final_raw_units,
        });
    }

    msg!("✅ Supply conversion applied:");
    msg!("  virtual_supply: {}", virtual_supply);
    msg!("  real_supply: {}", real_supply);
    msg!("  scale_factor: {:.6}", scale_factor_millions as f64 / 1_000_000.0);
    msg!("  raw_units: {} (fits in u64)", real_raw_units);

    Ok(SupplyConversionResult {
        real_supply,
        virtual_supply,
        scale_factor_millions,
        was_scaled: true,
        raw_units: real_raw_units,
    })
}

/// Gets the maximum safe supply for given decimals (without scaling)
/// 
/// # Arguments
/// * `decimals` - Token decimals (0-9)
/// 
/// # Returns
/// * Maximum supply that fits in u64 without scaling
pub fn get_max_safe_supply(decimals: u8) -> Result<u64, ProgramError> {
    if decimals > 9 {
        return Err(ProgramError::InvalidArgument);
    }
    let decimals_multiplier = 10u64.pow(decimals as u32);
    Ok(U64_MAX / decimals_multiplier)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_scaling_needed() {
        let result = convert_to_real_supply(1_000_000_000, 9).unwrap();
        assert_eq!(result.real_supply, 1_000_000_000);
        assert_eq!(result.virtual_supply, 1_000_000_000);
        assert_eq!(result.scale_factor_millions, 1_000_000);
        assert!(!result.was_scaled);
    }

    #[test]
    fn test_scaling_needed() {
        // 1 quadrillion with 9 decimals = 1e24, which exceeds u64::MAX
        let result = convert_to_real_supply(1_000_000_000_000_000, 9).unwrap();
        assert!(result.was_scaled);
        assert!(result.real_supply < result.virtual_supply);
        assert!(result.raw_units <= U64_MAX);
    }

    #[test]
    fn test_max_safe_supply() {
        let max = get_max_safe_supply(9).unwrap();
        assert_eq!(max, 18_446_744_073); // Approximately 18.4 billion
    }
}



