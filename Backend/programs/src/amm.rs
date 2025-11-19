use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};
use borsh::{BorshSerialize, BorshDeserialize};

// AMM struct for state management
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct AMM {
    pub base_token_mint: Pubkey,
    pub quote_token_mint: Pubkey,
    pub base_token_vault: Pubkey,
    pub quote_token_vault: Pubkey,
    pub lp_token_mint: Pubkey,
    pub fee_rate: u16,
    pub total_liquidity: u64,
    pub start_time: u64,
}

impl AMM {
    pub fn new(
        base_token_mint: Pubkey,
        quote_token_mint: Pubkey,
        base_token_vault: Pubkey,
        quote_token_vault: Pubkey,
        lp_token_mint: Pubkey,
        fee_rate: u16,
    ) -> Self {
        Self {
            base_token_mint,
            quote_token_mint,
            base_token_vault,
            quote_token_vault,
            lp_token_mint,
            fee_rate,
            total_liquidity: 0,
            start_time: 0,
        }
    }
}

pub fn get_amm_seeds(base_token_mint: Pubkey, quote_token_mint: Pubkey, amm_seed_keys: &mut Vec<Pubkey>) {
    // Sort the token mints to ensure deterministic PDA derivation
    // The smaller pubkey comes first
    if base_token_mint < quote_token_mint {
        amm_seed_keys.push(base_token_mint);
        amm_seed_keys.push(quote_token_mint);
    } else {
        amm_seed_keys.push(quote_token_mint);
        amm_seed_keys.push(base_token_mint);
    }
}

pub fn create_amm(
    _user: &AccountInfo,
    _amm_pool: &AccountInfo,
    _amm: &AccountInfo,
    _amm_quote: &AccountInfo,
    _quote_token_mint: &AccountInfo,
    _amm_base: &AccountInfo,
    _base_token_mint: &AccountInfo,
    _lp_token_mint: &AccountInfo,
    _quote_token_program: &AccountInfo,
    _base_token_program: &AccountInfo,
    _program_id: &Pubkey,
    _mm_rewards: u8,
    _trade_to_earn: &AccountInfo,
    _trade_to_earn_bump: u8,
) -> ProgramResult {
    // Stub implementation
    Ok(())
}

pub fn init_cook_amm_data<'a>(
    user: &AccountInfo<'a>,
    amm: &AccountInfo<'a>,
    program_id: &Pubkey,
    amm_bump_seed: u8,
    amm_seed_keys: &[Pubkey],
    amm_provider_bytes: &[u8],
    system_program: &AccountInfo<'a>,
) -> ProgramResult {
    use solana_program::{msg, program_error::ProgramError, program::{invoke, invoke_signed}, rent::Rent, sysvar::Sysvar, system_instruction};
    use borsh::BorshSerialize;
    
    // Check if account already exists
    let amm_lamports = {
        let lamports_guard = amm.try_borrow_lamports()?;
        let amount = **lamports_guard;
        drop(lamports_guard);
        amount
    };
    
    if amm_lamports > 0 {
        msg!("✅ AMM account already exists with {} lamports", amm_lamports);
        // Verify it's owned by our program
        if amm.owner != program_id {
            msg!("❌ Error: AMM account exists but is not owned by this program");
            msg!("  Owner: {}, Expected: {}", amm.owner, program_id);
            return Err(ProgramError::IllegalOwner);
        }
        return Ok(());
    }
    
    msg!("🔨 Creating AMM account using create_account (simplest approach)...");
    
    // Calculate AMM account size - use fixed size for simplicity
    // AMM struct: 32 + 32 + 32 + 32 + 32 + 2 + 8 + 8 = 178 bytes
    // But use serialization to get exact size
    let amm_instance = AMM::new(
        *user.key, // Placeholder - will be set properly later
        *user.key, // Placeholder
        *user.key, // Placeholder
        *user.key, // Placeholder
        *user.key, // Placeholder
        0, // fee_rate
    );
    let account_size = match amm_instance.try_to_vec() {
        Ok(data) => data.len(),
        Err(_) => {
            // Fallback to calculated size if serialization fails
            msg!("⚠️ Serialization failed, using calculated size");
            178 // 32*5 + 2 + 8 + 8
        }
    };
    
    // Calculate rent with VERY generous buffer (as suggested by user)
    let rent = Rent::get()?;
    let rent_minimum = rent.minimum_balance(account_size);
    let rent_buffer = 10_000_000u64; // 0.01 SOL buffer (very generous as suggested)
    let total_rent = rent_minimum.saturating_add(rent_buffer);
    
    msg!("  AMM account size: {} bytes", account_size);
    msg!("  Rent minimum: {} lamports", rent_minimum);
    msg!("  Rent buffer: {} lamports (0.01 SOL)", rent_buffer);
    msg!("  Total rent: {} lamports", total_rent);
    
    // Verify user has enough lamports
    let user_lamports = {
        let lamports_guard = user.try_borrow_lamports()?;
        let amount = **lamports_guard;
        drop(lamports_guard);
        amount
    };
    
    msg!("  User lamports: {} (need: {} for AMM rent)", user_lamports, total_rent);
    if user_lamports < total_rent {
        msg!("❌ Error: User has insufficient lamports to create AMM account!");
        msg!("  User has: {} lamports, Required: {} lamports", user_lamports, total_rent);
        return Err(ProgramError::InsufficientFunds);
    }
    
    // Alternative 4: Use create_account directly (simplest approach)
    // Create account with generous rent buffer
    let create_ix = system_instruction::create_account(
        user.key,
        amm.key,
        total_rent, // Use rent with big buffer (0.01 SOL)
        account_size as u64,
        program_id,
    );
    
    msg!("  📝 Creating AMM account (Alternative 4 - simplest approach)...");
    msg!("    Account: {}", amm.key);
    msg!("    Owner: {}", program_id);
    msg!("    Size: {} bytes", account_size);
    msg!("    Rent: {} lamports (with 0.01 SOL buffer)", total_rent);
    
    // Check if this is a PDA by verifying the expected address
    let (expected_amm_pda, expected_bump) = Pubkey::find_program_address(
        &[&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), amm_provider_bytes],
        program_id,
    );
    
    let is_pda = *amm.key == expected_amm_pda && amm_bump_seed == expected_bump;
    msg!("  Is PDA: {} (expected: {}, actual: {})", is_pda, expected_amm_pda, amm.key);
    
    let create_result = if is_pda {
        // Use invoke_signed for PDA
        msg!("  Using invoke_signed (PDA detected)...");
        let amm_seeds: &[&[u8]] = &[
            &amm_seed_keys[0].to_bytes(),
            &amm_seed_keys[1].to_bytes(),
            amm_provider_bytes,
            &[amm_bump_seed],
        ];
        invoke_signed(
            &create_ix,
            &[
                user.clone(),
                amm.clone(),
                system_program.clone(),
            ],
            &[amm_seeds],
        )
    } else {
        // Try invoke for regular account (Alternative 4)
        msg!("  Using invoke (regular account - Alternative 4)...");
        msg!("  ⚠️ Note: Account must be passed as writable from frontend");
        invoke(
            &create_ix,
            &[
                user.clone(),
                amm.clone(),
                system_program.clone(),
            ],
        )
    };
    
    match create_result {
        Ok(_) => {
            msg!("✅ AMM account created successfully");
            
            // Verify account was created with rent
            let amm_lamports_after = {
                let lamports_guard = amm.try_borrow_lamports()?;
                let amount = **lamports_guard;
                drop(lamports_guard);
                amount
            };
            msg!("  Account lamports after creation: {}", amm_lamports_after);
            
            if amm_lamports_after < rent_minimum {
                msg!("⚠️ Warning: AMM account may have insufficient rent (has: {}, required: {})", 
                     amm_lamports_after, rent_minimum);
            } else {
                msg!("✅ AMM account has sufficient rent ({} >= {})", amm_lamports_after, rent_minimum);
            }
        }
        Err(e) => {
            msg!("❌ Failed to create AMM account: {:?}", e);
            let user_lamports_after = {
                let lamports_guard = user.try_borrow_lamports()?;
                let amount = **lamports_guard;
                drop(lamports_guard);
                amount
            };
            msg!("  User lamports after failed creation: {}", user_lamports_after);
            msg!("  Required rent: {} lamports", total_rent);
            return Err(e);
        }
    }
    
    Ok(())
}

pub fn create_lp_mint(_user: &AccountInfo, _amm: &AccountInfo) -> ProgramResult {
    // Stub implementation
    Ok(())
}

