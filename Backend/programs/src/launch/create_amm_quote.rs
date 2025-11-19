use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program::invoke, program_error::ProgramError, pubkey::Pubkey,
};
use spl_token_2022::extension::StateWithExtensions;

use crate::{
    instruction::accounts::CreateAmmQuoteAccounts,
    utils,
};

pub fn create_amm_quote<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    msg!("🔨 Starting create_amm_quote instruction");
    
    if accounts.len() < 5 {
        msg!("❌ Error: Not enough accounts. Expected: 5, Got: {}", accounts.len());
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    
    let ctx: crate::instruction::accounts::Context<CreateAmmQuoteAccounts> = 
        CreateAmmQuoteAccounts::context(accounts)?;
    
    msg!("🔍 Verifying accounts...");
    msg!("  user: {} (signer: {})", ctx.accounts.user.key, ctx.accounts.user.is_signer);
    msg!("  amm: {}", ctx.accounts.amm.key);
    msg!("  quote_token_mint: {}", ctx.accounts.quote_token_mint.key);
    
    if !ctx.accounts.user.is_signer {
        msg!("❌ Error: User must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Derive the ATA address inside the program (not passed as an account)
    let amm_quote_ata = spl_associated_token_account::get_associated_token_address_with_program_id(
        ctx.accounts.amm.key,
        ctx.accounts.quote_token_mint.key,
        ctx.accounts.quote_token_program.key,
    );
    msg!("✅ Derived amm_quote ATA address: {}", amm_quote_ata);
    
    // Check if account already exists by trying to get it from remaining_accounts
    // or by checking if we can borrow lamports (but we need the account info)
    // Since we don't have the account in the instruction, we need to get it from remaining_accounts
    if ctx.remaining_accounts.is_empty() {
        msg!("❌ Error: amm_quote account must be provided in remaining_accounts");
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    
    let amm_quote_account = &ctx.remaining_accounts[0];
    
    // Verify it's the correct address
    if *amm_quote_account.key != amm_quote_ata {
        msg!("❌ Error: amm_quote address mismatch!");
        msg!("  Expected ATA: {}", amm_quote_ata);
        msg!("  Received: {}", amm_quote_account.key);
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Ensure it's writable
    if !amm_quote_account.is_writable {
        msg!("❌ Error: amm_quote must be writable");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check if account already exists
    if **amm_quote_account.try_borrow_lamports()? > 0 {
        msg!("ℹ️ amm_quote ATA already exists");
        // Verify it's initialized
        let account_data = amm_quote_account.data.borrow();
        if account_data.len() >= 165 {
            msg!("✅ amm_quote ATA already initialized");
            return Ok(());
        }
        drop(account_data);
    }
    
    // Create the account - user pays for it
    // Since amm_quote is in remaining_accounts (not in the main instruction accounts),
    // we can create it via CPI without privilege escalation
    msg!("🔨 Creating amm_quote ATA for Token-2022...");
    
    let account_size = 165u64;
    let token_lamports = utils::calculate_rent(account_size);
    
    msg!("  Account size: {} bytes, Rent: {} lamports", account_size, token_lamports);
    
    let create_ix = solana_program::system_instruction::create_account(
        ctx.accounts.user.key,
        amm_quote_account.key,
        token_lamports,
        account_size,
        ctx.accounts.quote_token_program.key,
    );
    
    msg!("  Invoking create_account...");
    invoke(
        &create_ix,
        &[
            ctx.accounts.user.clone(),
            amm_quote_account.clone(),
            ctx.accounts.system_program.clone(),
        ],
    )?;
    msg!("  ✅ Account created");
    
    // Initialize the account for Token-2022
    msg!("  Initializing account with Token-2022...");
    let init_ix = spl_token_2022::instruction::initialize_account3(
        ctx.accounts.quote_token_program.key,
        amm_quote_account.key,
        ctx.accounts.quote_token_mint.key,
        ctx.accounts.amm.key,
    )?;
    
    invoke(
        &init_ix,
        &[
            ctx.accounts.quote_token_program.clone(),
            amm_quote_account.clone(),
            ctx.accounts.quote_token_mint.clone(),
            ctx.accounts.amm.clone(),
        ],
    )?;
    msg!("  ✅ Account initialized");
    msg!("✅ amm_quote ATA created and initialized successfully");
    
    Ok(())
}

