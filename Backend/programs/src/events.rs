/**
 * On-chain Event Emission
 * 
 * Emits events that can be indexed by blockchain explorers and analytics tools
 * Uses Solana's msg! macro for event logging
 */

use solana_program::{
    msg,
    pubkey::Pubkey,
};

/// Event types that can be emitted
#[derive(Debug, Clone)]
pub enum EventType {
    LaunchCreated,
    PoolCreated,
    LiquidityLocked,
    ThresholdMet,
    BondingCurveClosed,
    TradingStarted,
    TokensPurchased,
    TokensSold,
    LiquidityAdded,
    LiquidityRemoved,
}

impl EventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EventType::LaunchCreated => "LAUNCH_CREATED",
            EventType::PoolCreated => "POOL_CREATED",
            EventType::LiquidityLocked => "LIQUIDITY_LOCKED",
            EventType::ThresholdMet => "THRESHOLD_MET",
            EventType::BondingCurveClosed => "BONDING_CURVE_CLOSED",
            EventType::TradingStarted => "TRADING_STARTED",
            EventType::TokensPurchased => "TOKENS_PURCHASED",
            EventType::TokensSold => "TOKENS_SOLD",
            EventType::LiquidityAdded => "LIQUIDITY_ADDED",
            EventType::LiquidityRemoved => "LIQUIDITY_REMOVED",
        }
    }
}

/// Emit a launch created event
pub fn emit_launch_created_event(
    token_mint: &Pubkey,
    creator: &Pubkey,
    launch_type: u8,
    total_supply: u64,
    ticket_price: u64,
) {
    msg!(
        "EVENT:{}:token_mint:{}:creator:{}:launch_type:{}:total_supply:{}:ticket_price:{}",
        EventType::LaunchCreated.as_str(),
        token_mint,
        creator,
        launch_type,
        total_supply,
        ticket_price
    );
}

/// Emit a pool created event
pub fn emit_pool_created_event(
    token_mint: &Pubkey,
    pool_address: &Pubkey,
    dex_provider: u8, // 0 = Cook, 1 = Raydium
    sol_amount: u64,
    token_amount: u64,
) {
    msg!(
        "EVENT:{}:token_mint:{}:pool_address:{}:dex_provider:{}:sol_amount:{}:token_amount:{}",
        EventType::PoolCreated.as_str(),
        token_mint,
        pool_address,
        dex_provider,
        sol_amount,
        token_amount
    );
}

/// Emit a liquidity locked event
pub fn emit_liquidity_locked_event(
    token_mint: &Pubkey,
    lock_address: &Pubkey,
    lp_token_mint: &Pubkey,
    locked_amount: u64,
    lock_duration: u64, // in seconds
    unlock_date: i64, // unix timestamp
    creator: &Pubkey,
) {
    msg!(
        "EVENT:{}:token_mint:{}:lock_address:{}:lp_token_mint:{}:locked_amount:{}:lock_duration:{}:unlock_date:{}:creator:{}",
        EventType::LiquidityLocked.as_str(),
        token_mint,
        lock_address,
        lp_token_mint,
        locked_amount,
        lock_duration,
        unlock_date,
        creator
    );
}

/// Emit a threshold met event
pub fn emit_threshold_met_event(
    token_mint: &Pubkey,
    threshold_amount: u64,
    current_amount: u64,
    pool_address: &Pubkey,
    dex_provider: u8,
) {
    msg!(
        "EVENT:{}:token_mint:{}:threshold_amount:{}:current_amount:{}:pool_address:{}:dex_provider:{}",
        EventType::ThresholdMet.as_str(),
        token_mint,
        threshold_amount,
        current_amount,
        pool_address,
        dex_provider
    );
}

/// Emit a bonding curve closed event
pub fn emit_bonding_curve_closed_event(
    token_mint: &Pubkey,
) {
    msg!(
        "EVENT:{}:token_mint:{}",
        EventType::BondingCurveClosed.as_str(),
        token_mint
    );
}

/// Emit a trading started event
pub fn emit_trading_started_event(
    token_mint: &Pubkey,
    pool_address: &Pubkey,
    dex_provider: u8,
) {
    msg!(
        "EVENT:{}:token_mint:{}:pool_address:{}:dex_provider:{}",
        EventType::TradingStarted.as_str(),
        token_mint,
        pool_address,
        dex_provider
    );
}

/// Emit a tokens purchased event
pub fn emit_tokens_purchased_event(
    token_mint: &Pubkey,
    buyer: &Pubkey,
    sol_amount: u64,
    tokens_received: u64,
    price: u64,
) {
    msg!(
        "EVENT:{}:token_mint:{}:buyer:{}:sol_amount:{}:tokens_received:{}:price:{}",
        EventType::TokensPurchased.as_str(),
        token_mint,
        buyer,
        sol_amount,
        tokens_received,
        price
    );
}

/// Emit a tokens sold event
pub fn emit_tokens_sold_event(
    token_mint: &Pubkey,
    seller: &Pubkey,
    tokens_amount: u64,
    sol_received: u64,
    price: u64,
) {
    msg!(
        "EVENT:{}:token_mint:{}:seller:{}:tokens_amount:{}:sol_received:{}:price:{}",
        EventType::TokensSold.as_str(),
        token_mint,
        seller,
        tokens_amount,
        sol_received,
        price
    );
}

/// Emit a liquidity added event
pub fn emit_liquidity_added_event(
    token_mint: &Pubkey,
    provider: &Pubkey,
    sol_amount: u64,
    token_amount: u64,
    lp_tokens_received: u64,
) {
    msg!(
        "EVENT:{}:token_mint:{}:provider:{}:sol_amount:{}:token_amount:{}:lp_tokens_received:{}",
        EventType::LiquidityAdded.as_str(),
        token_mint,
        provider,
        sol_amount,
        token_amount,
        lp_tokens_received
    );
}

/// Emit a liquidity removed event
pub fn emit_liquidity_removed_event(
    token_mint: &Pubkey,
    provider: &Pubkey,
    lp_tokens_amount: u64,
    sol_received: u64,
    tokens_received: u64,
) {
    msg!(
        "EVENT:{}:token_mint:{}:provider:{}:lp_tokens_amount:{}:sol_received:{}:tokens_received:{}",
        EventType::LiquidityRemoved.as_str(),
        token_mint,
        provider,
        lp_tokens_amount,
        sol_received,
        tokens_received
    );
}

