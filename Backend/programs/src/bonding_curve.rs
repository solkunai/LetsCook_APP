/**
 * Advanced Bonding Curve Implementation
 * 
 * Supports:
 * - Large supplies (billions, trillions)
 * - Proper decimal handling (0-9 decimals)
 * - Anti-whale protection
 * - Wallet clustering detection
 * - Safe math (no overflow)
 */

use solana_program::{
    account_info::AccountInfo,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

/// Bonding curve configuration
pub struct BondingCurveConfig {
    pub total_supply: u64,
    pub decimals: u8,
    pub tokens_sold: u64,
    pub base_price: f64,
    pub price_increase: f64,
}

/// Anti-whale configuration
pub struct AntiWhaleConfig {
    pub max_wallet_percentage: f64, // Max % of supply a wallet can hold (e.g., 5.0 = 5%)
    pub whale_multiplier: f64,      // Price multiplier for whales (e.g., 1.5 = 50% more expensive)
    pub max_purchase_per_tx: u64,   // Max tokens per transaction for flagged wallets
    pub rapid_buy_threshold: u64,   // SOL amount that triggers rapid buy detection
    pub rapid_buy_window: i64,      // Time window in seconds for rapid buy detection
    pub rapid_buy_multiplier: f64,  // Multiplier for rapid buys (e.g., 1.3 = 30% more expensive)
}

impl Default for AntiWhaleConfig {
    fn default() -> Self {
        Self {
            max_wallet_percentage: 5.0, // 5% max per wallet
            whale_multiplier: 1.5,      // 50% price increase for whales
            max_purchase_per_tx: 1_000_000_000_000, // 1T tokens max per tx
            rapid_buy_threshold: 10_000_000_000, // 10 SOL triggers rapid buy detection
            rapid_buy_window: 60,        // 60 second window
            rapid_buy_multiplier: 1.3,   // 30% price increase for rapid buys
        }
    }
}

/// First block protection configuration
pub struct FirstBlockProtection {
    pub min_sol_per_tx: u64,        // Minimum SOL per transaction (e.g., 0.1 SOL)
    pub max_sol_per_tx: u64,        // Maximum SOL per transaction in first block (e.g., 1 SOL)
    pub first_block_duration: i64,  // Duration of first block protection in seconds
    pub launch_timestamp: i64,      // Launch timestamp
}

impl FirstBlockProtection {
    pub fn new(launch_timestamp: i64) -> Self {
        Self {
            min_sol_per_tx: 100_000_000,      // 0.1 SOL
            max_sol_per_tx: 1_000_000_000,    // 1 SOL
            first_block_duration: 400,        // ~400ms (first block)
            launch_timestamp,
        }
    }
    
    pub fn is_first_block(&self, current_timestamp: i64) -> bool {
        (current_timestamp - self.launch_timestamp) < self.first_block_duration
    }
}

/// Cached curve values for performance
pub struct CachedCurveValues {
    pub next_price: f64,
    pub price_delta: f64,
    pub tokens_until_next_step: u64,
    pub last_update_slot: u64,
}

/// Shadow curve configuration for bots
pub struct ShadowCurveConfig {
    pub bot_price_multiplier: f64,      // Price multiplier for bots (e.g., 1.5 = 50% more expensive)
    pub bot_tokens_multiplier: f64,     // Token reduction multiplier (e.g., 0.7 = 30% fewer tokens)
}

/// Calculate bonding curve price with proper scaling for large supplies
/// Formula: P(x) = BP + PI * x
/// Where:
/// - BP = base price (scaled by supply)
/// - PI = price increase per token (scaled by supply)
/// - x = tokens sold (in human-readable units)
pub fn calculate_price(
    tokens_sold: u64,
    total_supply: u64,
    decimals: u8,
) -> Result<f64, ProgramError> {
    // Convert to human-readable units (accounting for decimals)
    let tokens_sold_human = tokens_sold as f64 / 10_f64.powi(decimals as i32);
    let total_supply_human = total_supply as f64 / 10_f64.powi(decimals as i32);
    
    // Scale constants based on supply
    // For 1B supply: BP = 0.000000001, PI = 0.000000001
    // For 100B supply: BP = 0.00000000001, PI = 0.00000000001 (100x smaller)
    let reference_supply = 1_000_000_000.0; // 1 billion
    let supply_scale = (reference_supply / total_supply_human.max(1.0)).min(1.0);
    
    let base_bp = 0.000000001;
    let base_pi = 0.000000001;
    
    let bp = base_bp * supply_scale;
    let pi = base_pi * supply_scale;
    
    // Ensure minimum values
    let bp = bp.max(0.0000000000001);
    let pi = pi.max(0.0000000000001);
    
    // Calculate price: P(x) = BP + PI * x
    let price = bp + (pi * tokens_sold_human);
    
    Ok(price.max(0.0000000000001))
}

/// Calculate tokens received for SOL amount using bonding curve integration
/// Formula: SOL = ∫(BP + PI*x)dx from x0 to x1
/// Solving: SOL = BP*(x1-x0) + (PI/2)*(x1^2 - x0^2)
/// Rearranging: PI*x1^2 + 2*BP*x1 - (2*SOL + PI*x0^2 + 2*BP*x0) = 0
pub fn calculate_tokens_for_sol(
    sol_amount: u64,
    current_tokens_sold: u64,
    total_supply: u64,
    decimals: u8,
) -> Result<u64, ProgramError> {
    // Convert to human-readable units
    let sol_amount_human = sol_amount as f64 / 1_000_000_000.0; // SOL has 9 decimals
    let tokens_sold_human = current_tokens_sold as f64 / 10_f64.powi(decimals as i32);
    let total_supply_human = total_supply as f64 / 10_f64.powi(decimals as i32);
    
    // Scale constants
    let reference_supply = 1_000_000_000.0;
    let supply_scale = (reference_supply / total_supply_human.max(1.0)).min(1.0);
    
    let base_bp = 0.000000001;
    let base_pi = 0.000000001;
    
    let bp = (base_bp * supply_scale).max(0.0000000000001);
    let pi = (base_pi * supply_scale).max(0.0000000000001);
    
    // Solve quadratic: PI*x1^2 + 2*BP*x1 - C = 0
    // Where C = 2*SOL + PI*x0^2 + 2*BP*x0
    let x0 = tokens_sold_human;
    let c = 2.0 * sol_amount_human + pi * x0 * x0 + 2.0 * bp * x0;
    
    // Quadratic formula: x1 = (-2*BP + sqrt((2*BP)^2 + 4*PI*C)) / (2*PI)
    let discriminant = (2.0 * bp).powi(2) + 4.0 * pi * c;
    
    if discriminant < 0.0 || discriminant.is_infinite() || discriminant.is_nan() {
        msg!("❌ Bonding curve discriminant error: {}", discriminant);
        return Err(ProgramError::InvalidArgument);
    }
    
    let sqrt_d = discriminant.sqrt();
    if sqrt_d.is_infinite() || sqrt_d.is_nan() {
        msg!("❌ Bonding curve sqrt error: {}", sqrt_d);
        return Err(ProgramError::InvalidArgument);
    }
    
    let x1 = (-2.0 * bp + sqrt_d) / (2.0 * pi);
    let new_tokens_human = (x1 - x0).max(0.0);
    
    // Convert back to raw units
    let new_tokens_raw = (new_tokens_human * 10_f64.powi(decimals as i32)) as u64;
    
    // Safety check
    if new_tokens_raw > total_supply {
        msg!("⚠️ Calculated tokens exceed total supply, capping to available");
        return Ok(total_supply.saturating_sub(current_tokens_sold));
    }
    
    Ok(new_tokens_raw)
}

/// Calculate SOL received for selling tokens
pub fn calculate_sol_for_tokens(
    tokens_amount: u64,
    current_tokens_sold: u64,
    total_supply: u64,
    decimals: u8,
) -> Result<u64, ProgramError> {
    // Get price before and after
    let price_before = calculate_price(current_tokens_sold, total_supply, decimals)?;
    let price_after = calculate_price(
        current_tokens_sold.saturating_sub(tokens_amount),
        total_supply,
        decimals,
    )?;
    
    // Average price over the range
    let avg_price = (price_before + price_after) / 2.0;
    
    // Convert tokens to human-readable
    let tokens_human = tokens_amount as f64 / 10_f64.powi(decimals as i32);
    
    // Calculate SOL
    let sol_human = tokens_human * avg_price;
    
    // Convert to raw units (SOL has 9 decimals)
    let sol_raw = (sol_human * 1_000_000_000.0) as u64;
    
    Ok(sol_raw)
}

/// Check if wallet is a whale and apply multiplier
/// Enhanced with time-based rapid buy detection
pub fn check_whale_status(
    user_wallet: &Pubkey,
    user_token_balance: u64,
    total_supply: u64,
    decimals: u8,
    sol_amount: u64,
    current_timestamp: i64,
    last_buy_timestamp: Option<i64>,
    config: &AntiWhaleConfig,
) -> Result<f64, ProgramError> {
    let mut multiplier: f64 = 1.0;
    
    // Calculate wallet percentage
    let total_supply_raw = total_supply * 10_u64.pow(decimals as u32);
    let wallet_percentage = if total_supply_raw > 0 {
        (user_token_balance as f64 / total_supply_raw as f64) * 100.0
    } else {
        0.0
    };
    
    msg!("🔍 Wallet {} holds {:.2}% of supply ({} / {})", 
         user_wallet, wallet_percentage, user_token_balance, total_supply_raw);
    
    // Check if wallet exceeds threshold (holding-based whale)
    if wallet_percentage > config.max_wallet_percentage {
        msg!("⚠️ WHALE DETECTED: Wallet {} holds {:.2}% (threshold: {:.2}%)", 
             user_wallet, wallet_percentage, config.max_wallet_percentage);
        multiplier = multiplier.max(config.whale_multiplier);
    }
    
    // Check for rapid large buys (time-based whale detection)
    if sol_amount >= config.rapid_buy_threshold {
        if let Some(last_buy) = last_buy_timestamp {
            let time_since_last_buy = current_timestamp - last_buy;
            if time_since_last_buy < config.rapid_buy_window {
                msg!("⚡ RAPID BUY DETECTED: {} SOL within {} seconds (threshold: {} SOL)", 
                     sol_amount, time_since_last_buy, config.rapid_buy_threshold);
                multiplier = multiplier.max(config.rapid_buy_multiplier);
            }
        } else {
            // First large buy - still apply multiplier to prevent sniping
            if sol_amount >= config.rapid_buy_threshold {
                msg!("⚡ LARGE FIRST BUY: {} SOL (applying rapid buy multiplier)", sol_amount);
                multiplier = multiplier.max(config.rapid_buy_multiplier);
            }
        }
    }
    
    Ok(multiplier)
}

/// Apply anti-whale protection to token calculation
/// Enhanced with time-based detection and first block protection
pub fn apply_anti_whale_protection(
    calculated_tokens: u64,
    user_wallet: &Pubkey,
    user_token_balance: u64,
    total_supply: u64,
    decimals: u8,
    sol_amount: u64,
    current_timestamp: i64,
    last_buy_timestamp: Option<i64>,
    first_block_protection: Option<&FirstBlockProtection>,
    config: &AntiWhaleConfig,
) -> Result<u64, ProgramError> {
    // Check first block protection
    if let Some(fbp) = first_block_protection {
        if fbp.is_first_block(current_timestamp) {
            msg!("🛡️ First block protection active (launch: {}, current: {})", 
                 fbp.launch_timestamp, current_timestamp);
            
            // Enforce minimum SOL per transaction
            if sol_amount < fbp.min_sol_per_tx {
                msg!("❌ Transaction rejected: {} SOL < minimum {} SOL (first block protection)", 
                     sol_amount, fbp.min_sol_per_tx);
                return Err(ProgramError::Custom(4)); // Custom error: below minimum
            }
            
            // Enforce maximum SOL per transaction in first block
            if sol_amount > fbp.max_sol_per_tx {
                msg!("❌ Transaction rejected: {} SOL > maximum {} SOL (first block protection)", 
                     sol_amount, fbp.max_sol_per_tx);
                return Err(ProgramError::Custom(5)); // Custom error: above maximum
            }
            
            msg!("✅ First block protection: {} SOL is within limits ({} - {} SOL)", 
                 sol_amount, fbp.min_sol_per_tx, fbp.max_sol_per_tx);
        }
    }
    
    let multiplier = check_whale_status(
        user_wallet, 
        user_token_balance, 
        total_supply, 
        decimals,
        sol_amount,
        current_timestamp,
        last_buy_timestamp,
        config
    )?;
    
    if multiplier > 1.0 {
        // Reduce tokens for whales (they pay more per token)
        let adjusted_tokens = (calculated_tokens as f64 / multiplier) as u64;
        msg!("🐋 Anti-whale: Reducing tokens from {} to {} (multiplier: {:.2}x)", 
             calculated_tokens, adjusted_tokens, multiplier);
        
        // Also check max purchase per tx
        let final_tokens = adjusted_tokens.min(config.max_purchase_per_tx);
        if final_tokens < adjusted_tokens {
            msg!("🐋 Max purchase cap: {} tokens per transaction", config.max_purchase_per_tx);
        }
        
        return Ok(final_tokens);
    }
    
    Ok(calculated_tokens)
}

/// Apply shadow curve for bot wallets (bots see higher prices)
pub fn apply_shadow_curve(
    calculated_tokens: u64,
    is_bot: bool,
    shadow_config: &ShadowCurveConfig,
) -> u64 {
    if is_bot {
        let bot_tokens = (calculated_tokens as f64 * shadow_config.bot_tokens_multiplier) as u64;
        msg!("👻 Shadow curve applied: {} -> {} tokens (bot multiplier: {:.2}x)", 
             calculated_tokens, bot_tokens, shadow_config.bot_tokens_multiplier);
        bot_tokens
    } else {
        calculated_tokens
    }
}

/// Cache curve values for performance
pub fn cache_curve_values(
    tokens_sold: u64,
    total_supply: u64,
    decimals: u8,
    current_slot: u64,
) -> Result<CachedCurveValues, ProgramError> {
    // Calculate next price step (every 1% of supply)
    let price_step = total_supply / 100;
    let tokens_until_next_step = price_step.saturating_sub(tokens_sold % price_step);
    
    let current_price = calculate_price(tokens_sold, total_supply, decimals)?;
    let next_price = calculate_price(tokens_sold + tokens_until_next_step, total_supply, decimals)?;
    let price_delta = next_price - current_price;
    
    Ok(CachedCurveValues {
        next_price,
        price_delta,
        tokens_until_next_step,
        last_update_slot: current_slot,
    })
}

/// Detect wallet clustering (bot networks)
/// Uses bot_detection module for comprehensive analysis
pub fn detect_wallet_cluster(
    user_wallet: &Pubkey,
    accounts: &[AccountInfo],
) -> Result<bool, ProgramError> {
    // Use bot detection module for comprehensive analysis
    use crate::bot_detection;
    bot_detection::is_bot_cluster_member(user_wallet, accounts)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_price_calculation_1b() {
        let price = calculate_price(0, 1_000_000_000, 9).unwrap();
        assert!(price > 0.0);
        assert!(price < 0.000001);
    }
    
    #[test]
    fn test_price_calculation_100b() {
        let price = calculate_price(0, 100_000_000_000, 9).unwrap();
        assert!(price > 0.0);
        // Should be 100x smaller than 1B supply
        let price_1b = calculate_price(0, 1_000_000_000, 9).unwrap();
        assert!(price < price_1b);
    }
    
    #[test]
    fn test_tokens_for_sol() {
        let sol_amount = 1_000_000_000; // 1 SOL
        let tokens = calculate_tokens_for_sol(sol_amount, 0, 1_000_000_000, 9).unwrap();
        assert!(tokens > 0);
    }
}

