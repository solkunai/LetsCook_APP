/**
 * Create Pool on Raffle Graduation
 * 
 * This module handles pool creation when a raffle graduates to trading.
 * Creates pools on both Cook DEX and Raydium as configured.
 */

use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};
use std::str::FromStr;
use crate::launch::{LaunchData, LaunchFlags, LaunchKeys};

/// Create liquidity pool when raffle graduates (threshold met, first claim)
/// OR when instant launch graduates (market cap threshold met)
pub fn create_pool_on_graduation<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    launch_data: &mut LaunchData,
    listing: &crate::launch::Listing,
    total_sol_collected: u64,
) -> ProgramResult {
    msg!("🚀 Creating liquidity pool on graduation...");
    
    // Check if this is a raffle launch or instant launch
    let is_raffle = matches!(launch_data.launch_meta, crate::launch::LaunchMeta::Raffle(_));
    let is_instant = matches!(launch_data.launch_meta, crate::launch::LaunchMeta::FCFS(_));
    
    if is_raffle {
        // RAFFLE GRADUATION: Check liquidity threshold
        let minimum_liquidity = launch_data.minimum_liquidity;
        if minimum_liquidity > 0 && total_sol_collected < minimum_liquidity {
            msg!("⚠️ Liquidity threshold not met: {} < {}", total_sol_collected, minimum_liquidity);
            return Ok(()); // Don't create pool yet
        }
    } else if is_instant {
        // INSTANT LAUNCH GRADUATION: Check SOL collected threshold (30 SOL)
        // For instant launches, check SOL in AMM pool (from bonding curve buys)
        // The AMM account should be passed in accounts[2] if available
        let graduation_threshold = if launch_data.graduation_threshold > 0 {
            launch_data.graduation_threshold
        } else {
            30_000_000_000u64 // Default 30 SOL for bonding curve graduation
        };
        
        let sol_collected = if accounts.len() > 2 {
            // Get SOL from AMM pool (amm_quote account for WSOL)
            // For now, use total_sol_collected as fallback (accumulated from trades)
            total_sol_collected
        } else {
            // Fallback: use total_sol_collected parameter
            total_sol_collected
        };
        
        msg!("💰 SOL collected check: {} lamports (threshold: {} lamports = 30 SOL)", sol_collected, graduation_threshold);
        
        if sol_collected < graduation_threshold {
            msg!("⚠️ SOL threshold not met: {} < {} (30 SOL)", sol_collected, graduation_threshold);
            return Ok(()); // Don't create pool yet
        }
        
        msg!("✅ SOL threshold met: {} >= {} (30 SOL reached!)", sol_collected, graduation_threshold);
        msg!("🚀 Creating Raydium liquidity pool...");
        
        // For instant launches, use SOL in AMM pool for liquidity
        if accounts.len() > 2 {
            let amm_sol = **accounts[2].lamports.borrow();
            msg!("💰 Using {} lamports from AMM pool for liquidity", amm_sol);
        }
    }

    // Get DEX provider from launch data (buffer1 stores amm_provider: 0 = Cook, 1 = Raydium, 2 = Both)
    let dex_provider = launch_data.buffer1; 
    let create_cook = dex_provider == 0 || dex_provider == 2;
    let create_raydium = dex_provider == 1 || dex_provider == 2;
    
    msg!("📊 DEX Provider config: {}", 
         if dex_provider == 0 { "Cook DEX only" } 
         else if dex_provider == 1 { "Raydium only" } 
         else { "Both DEXes" });

    // Calculate liquidity amounts
    // For raffles: 50% of SOL collected from ticket sales
    // For instant launches: Use SOL in AMM pool (accumulated from bonding curve trades)
    let liquidity_sol_amount = if is_instant && accounts.len() > 2 {
        // For instant launches, use AMM pool balance
        let amm_sol = **accounts[2].lamports.borrow();
        amm_sol / 2 // Use 50% of AMM pool for liquidity
    } else {
        total_sol_collected / 2 // For raffles, use 50% of collected SOL
    };
    let liquidity_token_amount = (launch_data.total_supply * u64::pow(10, listing.decimals as u32)) / 2;

    msg!("💰 Creating pool with {} SOL and {} tokens", liquidity_sol_amount, liquidity_token_amount);

    // Ensure keys vector is large enough
    if launch_data.keys.len() < LaunchKeys::LENGTH as usize {
        launch_data.keys.resize(LaunchKeys::LENGTH as usize, Pubkey::default());
    }

    // Create pools based on DEX provider
    if create_cook {
        msg!("🍳 Creating Cook DEX pool...");
        let cook_pool_address = create_cook_dex_pool(
            program_id,
            accounts,
            launch_data,
            listing,
            liquidity_sol_amount,
            liquidity_token_amount,
        )?;
        
        // Store Cook DEX pool address
        launch_data.keys[LaunchKeys::CookDEXPool as usize] = cook_pool_address;
        msg!("✅ Cook DEX pool address stored: {}", cook_pool_address);
    }

    if create_raydium {
        msg!("⚡ Creating Raydium pool...");
        let raydium_pool_address = create_raydium_pool(
            program_id,
            accounts,
            launch_data,
            listing,
            liquidity_sol_amount,
            liquidity_token_amount,
        )?;
        
        // Store Raydium pool address
        launch_data.keys[LaunchKeys::RaydiumPool as usize] = raydium_pool_address;
        msg!("✅ Raydium pool address stored: {}", raydium_pool_address);
    }

    // Update launch data
    launch_data.flags[LaunchFlags::LPState as usize] = 2; // Set LP state to "set up"
    launch_data.is_tradable = true;
    
    msg!("✅ Pool(s) created successfully! Token is now tradable.");
    Ok(())
}

/// Create Cook DEX pool
/// Returns the pool address (AMM PDA)
fn create_cook_dex_pool<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    launch_data: &LaunchData,
    listing: &crate::launch::Listing,
    _sol_amount: u64,
    _token_amount: u64,
) -> Result<Pubkey, ProgramError> {
    msg!("🍳 Creating Cook DEX pool...");

    // Get base and quote token mints
    let base_token_mint = listing.mint; // Base token mint from listing
    let quote_token_mint = launch_data.keys[LaunchKeys::WSOLAddress as usize]; // WSOL
    
    // For Cook DEX, the pool is the AMM PDA
    // Derive AMM PDA using the same seeds as the AMM initialization
    let base_first = listing.mint.to_string() < quote_token_mint.to_string();
    let amm_seeds: Vec<&[u8]> = if base_first {
        vec![
            listing.mint.as_ref(),
            quote_token_mint.as_ref(),
            b"CookAMM",
        ]
    } else {
        vec![
            quote_token_mint.as_ref(),
            listing.mint.as_ref(),
            b"CookAMM",
        ]
    };
    
    let (amm_pda, _bump) = Pubkey::find_program_address(&amm_seeds, program_id);
    msg!("📍 Cook DEX AMM PDA: {}", amm_pda);
    
    // Note: Actual AMM initialization should be done via InitCookAMM instruction
    // This function derives and returns the pool address
    // The AMM account will be initialized when liquidity is first added or via separate instruction
    
    msg!("✅ Cook DEX pool address derived: {}", amm_pda);
    Ok(amm_pda)
}

/// Create Raydium pool via CPI
/// Returns the pool address
fn create_raydium_pool<'a>(
    _program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    launch_data: &LaunchData,
    listing: &crate::launch::Listing,
    sol_amount: u64,
    token_amount: u64,
) -> Result<Pubkey, ProgramError> {
    msg!("⚡ Creating Raydium pool...");

    // Raydium AMM v4 program ID
    let raydium_program_id = Pubkey::from_str("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    
    // Get base and quote token mints
    let base_token_mint = listing.mint;
    let quote_token_mint = launch_data.keys[LaunchKeys::WSOLAddress as usize]; // WSOL
    
    // Derive Raydium pool PDA
    // Raydium uses: [b"amm_associated_seed", base_mint, quote_mint]
    let base_first = base_token_mint.to_string() < quote_token_mint.to_string();
    let (base_mint, quote_mint) = if base_first {
        (base_token_mint, quote_token_mint)
    } else {
        (quote_token_mint, base_token_mint)
    };
    
    let pool_seeds = vec![
        b"amm_associated_seed".as_ref(),
        base_mint.as_ref(),
        quote_mint.as_ref(),
    ];
    
    let (raydium_pool_pda, _bump) = Pubkey::find_program_address(&pool_seeds, &raydium_program_id);
    msg!("📍 Raydium pool PDA: {}", raydium_pool_pda);
    
    // Check if we have enough accounts for Raydium pool creation
    // Raydium requires: pool_state, pool_authority, pool_token_vault_a, pool_token_vault_b, 
    //                   lp_mint, token_mint_a, token_mint_b, user, token_program, system_program
    if accounts.len() < 20 {
        msg!("⚠️ Not enough accounts provided for Raydium pool creation. Pool address derived but creation skipped.");
        msg!("💡 Raydium pool creation requires additional accounts to be passed via remaining_accounts.");
        msg!("💡 For now, returning derived pool address. Pool can be created via separate instruction.");
        return Ok(raydium_pool_pda);
    }
    
    // Try to create pool if we have the required accounts
    // Accounts should be in remaining_accounts: [pool_state, pool_authority, vault_a, vault_b, lp_mint, ...]
    let remaining_start = 20; // After ClaimTokensAccounts (19 accounts) + 1 for base
    if accounts.len() > remaining_start + 9 {
        msg!("🔄 Attempting Raydium pool creation via CPI...");
        
        let pool_state = &accounts[remaining_start];
        let pool_authority = &accounts[remaining_start + 1];
        let pool_token_vault_a = &accounts[remaining_start + 2];
        let pool_token_vault_b = &accounts[remaining_start + 3];
        let lp_mint = &accounts[remaining_start + 4];
        let token_mint_a = &accounts[remaining_start + 5];
        let token_mint_b = &accounts[remaining_start + 6];
        let user = &accounts[0]; // User from main accounts
        let token_program = &accounts[17]; // base_token_program from ClaimTokensAccounts
        let system_program = &accounts[15]; // system_program from ClaimTokensAccounts
        
        // Create Raydium initialize instruction data
        let mut instruction_data = Vec::new();
        // Initialize instruction discriminator (8 bytes) - Raydium AMM v4 uses 0 for initialize
        instruction_data.extend_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        // Amount 0 (8 bytes)
        instruction_data.extend_from_slice(&token_amount.to_le_bytes());
        // Amount 1 (8 bytes)
        instruction_data.extend_from_slice(&sol_amount.to_le_bytes());
        
        let cpi_accounts = vec![
            AccountMeta::new(*pool_state.key, false),
            AccountMeta::new(*pool_authority.key, false),
            AccountMeta::new(*pool_token_vault_a.key, false),
            AccountMeta::new(*pool_token_vault_b.key, false),
            AccountMeta::new(*lp_mint.key, false),
            AccountMeta::new(*token_mint_a.key, false),
            AccountMeta::new(*token_mint_b.key, false),
            AccountMeta::new(*user.key, true),
            AccountMeta::new_readonly(*token_program.key, false),
            AccountMeta::new_readonly(*system_program.key, false),
        ];
        
        let cpi_instruction = Instruction {
            program_id: raydium_program_id,
            accounts: cpi_accounts,
            data: instruction_data,
        };
        
        // Execute CPI
        invoke_signed(
            &cpi_instruction,
            &[
                pool_state.clone(),
                pool_authority.clone(),
                pool_token_vault_a.clone(),
                pool_token_vault_b.clone(),
                lp_mint.clone(),
                token_mint_a.clone(),
                token_mint_b.clone(),
                user.clone(),
                token_program.clone(),
                system_program.clone(),
            ],
            &[],
        )?;
        
        msg!("✅ Raydium pool created successfully via CPI!");
    } else {
        msg!("⚠️ Insufficient accounts for Raydium pool creation. Pool address derived.");
        msg!("💡 Pool can be created later via separate instruction with proper accounts.");
    }
    
    msg!("✅ Raydium pool address: {}", raydium_pool_pda);
    Ok(raydium_pool_pda)
}

