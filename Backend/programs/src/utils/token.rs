use solana_program::{
    account_info::AccountInfo,
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack},
    rent,
    sysvar::Sysvar,
};
use spl_token_2022::{
    extension::{BaseStateWithExtensions, StateWithExtensions},
    state::Account,
};

use crate::utils;
use crate::{state, utils::calculate_rent};

pub fn get_token_balance<'a>(token_source_account: &AccountInfo<'a>) -> u64 {
    let base_data = &token_source_account.try_borrow_data().unwrap();
    let account_state = StateWithExtensions::<Account>::unpack(base_data).unwrap();

    return account_state.base.amount;
}

pub fn get_amount_post_transfer_fee<'a>(quantity: u64, token_mint: &AccountInfo<'a>) -> Result<u64, ProgramError> {
    let token_mint_data = token_mint.data.borrow();
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&token_mint_data)?;
    let quantity_after_transfer = if let Ok(transfer_fee_config) = mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>()
    {
        let fee = transfer_fee_config
            .calculate_epoch_fee(Clock::get()?.epoch, quantity)
            .ok_or(ProgramError::InvalidArgument)?;
        quantity.saturating_sub(fee)
    } else {
        quantity
    };

    Ok(quantity_after_transfer)
}

pub fn get_amount_pre_transfer_fee<'a>(quantity: u64, token_mint: &AccountInfo<'a>) -> Result<u64, ProgramError> {
    let token_mint_data = token_mint.data.borrow();
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&token_mint_data)?;
    let quantity_for_transfer = if let Ok(transfer_fee_config) = mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>() {
        let fee = transfer_fee_config
            .calculate_inverse_epoch_fee(Clock::get()?.epoch, quantity)
            .ok_or(ProgramError::InvalidArgument)?;
        quantity.saturating_add(fee)
    } else {
        quantity
    };

    Ok(quantity_for_transfer)
}

pub fn create_token_account<'a>(
    user_account_info: &'a AccountInfo<'a>,
    token_account: &'a AccountInfo<'a>,
    token_mint: &AccountInfo<'a>,
    token_program: &'a AccountInfo<'a>,
    pda_account: &'a AccountInfo<'a>,
    bump_seed: u8,
    seed: Vec<&[u8]>,
) -> ProgramResult {
    if **token_account.try_borrow_lamports()? > 0 {
        msg!("Token account is already initialised.");
        return Ok(());
    }

    let token_lamports = calculate_rent(spl_token_2022::state::Account::LEN as u64);

    // create the token account
    let base_ix = solana_program::system_instruction::create_account(
        user_account_info.key,
        token_account.key,
        token_lamports,
        spl_token_2022::state::Account::LEN as u64,
        token_program.key,
    );

    //let seed_refs: Vec<&[u8]> = seed.iter().map(|s| *s).collect();

    // Create the full seeds array including the bump
    //let mut full_seeds = seed_refs.clone();

    // Create the bump seed array first so it lives long enough
    //let bump_seed = [pda_bump];

    //full_seeds.push(&bump_seed);

    // Create the seeds slice for invoke_signed
    //let signer_seeds = &[full_seeds.as_slice()];

    invoke_signed(
        &base_ix,
        &[user_account_info.clone(), token_account.clone(), token_program.clone()],
        &[&[seed[0], seed[1], &[bump_seed]]],
    )?;

    let init_base_idx =
        spl_token_2022::instruction::initialize_account3(token_program.key, token_account.key, token_mint.key, pda_account.key).unwrap();

    invoke_signed(
        &init_base_idx,
        &[token_program.clone(), token_account.clone(), token_mint.clone(), pda_account.clone()],
        &[&[seed[0], seed[1], &[bump_seed]]],
    )?;

    Ok(())
}

pub fn create_2022_token<'a>(
    funding_account: &'a AccountInfo<'a>,
    pda_account: &'a AccountInfo<'a>,
    token_program: &'a AccountInfo<'a>,
    pda_bump: u8,
    system_program: &'a AccountInfo<'a>,
    associated_token_program: &'a AccountInfo<'a>,

    // nft accounts
    mint_account: &'a AccountInfo<'a>,
    token_account: &'a AccountInfo<'a>,
    token_account_owner: &'a AccountInfo<'a>,
    token_config: state::TokenDetails,

    // token extensions
    transfer_fee: u16,
    max_transfer_fee: u64,
    permanent_delegate_option: Option<&'a AccountInfo<'a>>,
    transfer_hook_program_option: Option<&'a AccountInfo<'a>>,
    
    // Optional mint seeds for PDA creation (if None, assumes regular account)
    mint_seeds: Option<&[&[u8]]>,
    
    // Optional token account PDA seeds (if provided, token_account is a PDA and will be initialized with these seeds)
    token_account_pda_seeds: Option<&[&[u8]]>,
) -> ProgramResult {
    let mut extension_types: Vec<spl_token_2022::extension::ExtensionType> = Vec::new();

    if transfer_fee > 0 {
        extension_types.push(spl_token_2022::extension::ExtensionType::TransferFeeConfig);
    }

    if permanent_delegate_option.is_some() {
        extension_types.push(spl_token_2022::extension::ExtensionType::PermanentDelegate);
    }
    if transfer_hook_program_option.is_some() {
        extension_types.push(spl_token_2022::extension::ExtensionType::TransferHook);
    }

    // Add metadata pointer extension
    extension_types.push(spl_token_2022::extension::ExtensionType::MetadataPointer);

    // Calculate space needed for mint extension structure
    // try_calculate_account_len returns the base size: base mint (82 bytes) + extension structure (34 bytes for MetadataPointer)
    // CRITICAL: Metadata (name, symbol, URI) is stored as a TLV entry IN the mint account itself
    // We must calculate the metadata instance size and add it to the account size
    let base_account_size = spl_token_2022::extension::ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(&extension_types).unwrap();
    
    // Calculate metadata instance size (the actual name, symbol, URI stored in the mint account)
    // This is stored as a TLV (Type-Length-Value) entry directly in the mint account
    // CRITICAL: We must calculate this BEFORE creating the account so it's large enough!
    
    // Instead of constructing TokenMetadata (which has type conflicts), calculate size directly:
    // Borsh serialization: 8-byte discriminator + 4-byte length + data
    // Data includes: name (String), symbol (String), uri (String), update_authority (OptionalNonZeroPubkey = 33 bytes), mint (Pubkey = 32 bytes), additional_metadata (Vec = 4 bytes length)
    
    // Calculate size of each field when serialized as Borsh:
    // String serialization: 4-byte length + bytes
    let name_len = 4 + token_config.name.len();
    let symbol_len = 4 + token_config.symbol.len();
    let uri_len = 4 + token_config.uri.len();
    // OptionalNonZeroPubkey: 1 byte (Some/None) + 32 bytes (Pubkey if Some)
    let update_authority_len = 33; // Always 33 bytes (1 byte tag + 32 byte pubkey)
    let mint_len = 32; // Pubkey is 32 bytes
    let additional_metadata_len = 4; // Vec length prefix (empty vec)
    
    // Total serialized size (without discriminator and length prefix)
    let metadata_data_size = name_len + symbol_len + uri_len + update_authority_len + mint_len + additional_metadata_len;
    
    // TLV entry: 8-byte discriminator + 4-byte length + data
    let metadata_instance_size = 8 + 4 + metadata_data_size;
    
    // Round up to 8-byte boundary (required for account alignment)
    let metadata_padded_size = ((metadata_instance_size + 7) / 8) * 8;
    
    // Total account size = base size + metadata padded size
    let account_size = base_account_size as u64 + metadata_padded_size as u64;
    
    msg!("📏 Account size calculation:");
    msg!("  Base account size: {} bytes", base_account_size);
    msg!("  Metadata data size: {} bytes (name: {} + symbol: {} + uri: {} + update_authority: {} + mint: {} + additional_metadata: {})", 
         metadata_data_size, name_len, symbol_len, uri_len, update_authority_len, mint_len, additional_metadata_len);
    msg!("  Metadata instance size: {} bytes (discriminator: 8 + length: 4 + data: {})", metadata_instance_size, metadata_data_size);
    msg!("  Metadata padded size: {} bytes (8-byte aligned)", metadata_padded_size);
    msg!("  Total mint account size: {} bytes (base + metadata)", account_size);
    
    // Ensure minimum size (base 82 + MetadataPointer 34 = 116, but usually rounded to 165 for alignment)
    let min_required_size = 82 + 34; // Base + MetadataPointer extension
    if (account_size as usize) < min_required_size {
        msg!("⚠️ Warning: Calculated size {} < minimum required size {}, using minimum", account_size, min_required_size);
        // Use the calculated size from try_calculate_account_len (it handles alignment)
    }
    
    // Use Rent::get() for accurate rent calculation from sysvar
    // This is more accurate than calculate_rent() which uses Rent::default()
    let rent_sysvar = rent::Rent::get()?;
    let mint_rent_base = rent_sysvar.minimum_balance(account_size as usize);
    let calculated_rent_fallback = calculate_rent(account_size as u64);
    msg!("  Account size: {} bytes", account_size);
    msg!("  Rent (from sysvar): {} lamports", mint_rent_base);
    msg!("  Rent (calculated fallback): {} lamports", calculated_rent_fallback);
    
    // Use the sysvar rent, but ensure it's at least the calculated rent (for Eclipse network)
    let mint_rent = if state::NETWORK == state::Network::Eclipse {
        calculated_rent_fallback // Use calculated rent for Eclipse
    } else {
        mint_rent_base // Use sysvar rent for Solana
    };
    
    // Add a small buffer (0.001 SOL = 1,000,000 lamports) to ensure we have enough rent
    // This accounts for any potential account size growth during initialization
    let rent_buffer = 1_000_000u64; // 0.001 SOL buffer
    let mint_rent_with_buffer = mint_rent.saturating_add(rent_buffer);
    msg!("  Using rent: {} lamports (base: {} + buffer: {})", mint_rent_with_buffer, mint_rent, rent_buffer);

    let account_lamports = **mint_account.try_borrow_lamports()?;
    msg!("  Current account lamports: {}", account_lamports);

    // Check if mint account already exists
    if account_lamports == 0 {
        msg!("Creating mint account with size: {} bytes (base mint + MetadataPointer extension)", 
             account_size);
        
        // Check if mint_seeds provided (PDA) or not (regular account)
        if let Some(seeds) = mint_seeds {
            msg!("Creating PDA mint account with create_account + invoke_signed");
            // For PDA accounts owned by an external program (Token-2022), we can use create_account
            // IF our program can sign for the PDA using invoke_signed with the mint seeds
            // The mint PDA is derived from our program's seeds: [b"cook", b"TokenMint", page_name, bump]
            // So our program can sign for it using invoke_signed
            
            let ix = solana_program::system_instruction::create_account(
                funding_account.key, 
                mint_account.key, 
                mint_rent_with_buffer,
                account_size as u64, 
                token_program.key
            );
            
            msg!("Creating PDA mint account");
            msg!("  Mint account: {}", mint_account.key);
            msg!("  Owner: {}", token_program.key);
            msg!("  Using invoke_signed with mint seeds");
            
            // Use invoke_signed with the mint PDA seeds - our program signs for the mint PDA
            // Accounts needed: funding, mint (being created), system_program
            invoke_signed(
                &ix,
                &[
                    funding_account.clone(), 
                    mint_account.clone(),
                    system_program.clone(),
                ],
                &[seeds], // Sign with mint PDA seeds - our program can sign for PDAs derived from our program
            )?;
            msg!("✅ PDA mint account created");
        } else {
            msg!("Creating regular mint account with create_account");
            let ix = solana_program::system_instruction::create_account(
                funding_account.key, 
                mint_account.key, 
                mint_rent_with_buffer,
                account_size as u64, 
                token_program.key
            );
            // For regular accounts, we need: funding account, account being created, system program
            invoke(
                &ix, 
                &[
                    funding_account.clone(), 
                    mint_account.clone(),
                    system_program.clone(),
                ]
            )?;
            msg!("✅ Regular mint account created");
        }
        
        // Verify account has enough lamports for rent after creation
        let account_lamports_after = **mint_account.try_borrow_lamports()?;
        msg!("🔍 Verifying account after creation:");
        msg!("  Account lamports: {}", account_lamports_after);
        msg!("  Required rent (base): {} lamports", mint_rent);
        msg!("  Required rent (with buffer): {} lamports", mint_rent_with_buffer);
        if account_lamports_after < mint_rent {
            msg!("❌ Error: Account has insufficient lamports for rent!");
            msg!("  Account: {} lamports, Required (base): {} lamports", account_lamports_after, mint_rent);
            return Err(ProgramError::InsufficientFunds);
        }
        msg!("✅ Account has sufficient lamports for rent (has: {}, required: {})", account_lamports_after, mint_rent);
    } else {
        msg!("Mint account already exists (has {} lamports)", account_lamports);
        // Check if existing account has enough rent
        if account_lamports < mint_rent {
            msg!("⚠️ Existing account has insufficient rent!");
            msg!("  Current: {} lamports, Required (base): {} lamports", account_lamports, mint_rent);
            msg!("  Required (with buffer): {} lamports", mint_rent_with_buffer);
            // Use buffer amount to ensure we have enough
            let additional_lamports = mint_rent_with_buffer.saturating_sub(account_lamports);
            msg!("  Transferring additional {} lamports for rent", additional_lamports);
            
            // Transfer additional lamports to cover rent
            solana_program::program::invoke(
                &solana_program::system_instruction::transfer(
                    funding_account.key,
                    mint_account.key,
                    additional_lamports,
                ),
                &[
                    funding_account.clone(),
                    mint_account.clone(),
                    system_program.clone(),
                ],
            )?;
            
            let account_lamports_after = **mint_account.try_borrow_lamports()?;
            msg!("✅ Account topped up: {} lamports (required: {})", account_lamports_after, mint_rent);
        } else {
            msg!("✅ Existing account has sufficient rent");
        }
    }

    // ============================================
    // STEP 1: Initialize extension configurations FIRST
    // ============================================
    // Extension configurations must be initialized BEFORE InitializeMint2
    // They set up the extension structure in the account (stored after base mint structure)
    // InitializeMint2 only checks the base mint structure area (first 82 bytes), so this is safe
    
    // STEP 1: Initialize extension configurations FIRST
    if transfer_fee > 0 {
        msg!("🔨 STEP 1a: Initializing transfer fee config...");
        let config_init_idx = spl_token_2022::extension::transfer_fee::instruction::initialize_transfer_fee_config(
            &spl_token_2022::ID,
            &mint_account.key,
            None,
            Some(&funding_account.key),
            transfer_fee,
            max_transfer_fee,
        )?;

        invoke(&config_init_idx, &[token_program.clone(), mint_account.clone(), funding_account.clone()])?;
        msg!("✅ Transfer fee config initialized");
    }

    if permanent_delegate_option.is_some() {
        let permanent_delegate = permanent_delegate_option.unwrap();
        msg!("🔨 STEP 1b: Initializing permanent delegate config...");
        let config_init_idx =
            spl_token_2022::instruction::initialize_permanent_delegate(
                &token_program.key, 
                &mint_account.key, 
                &permanent_delegate.key
            )?;

        invoke(
            &config_init_idx,
            &[token_program.clone(), mint_account.clone(), permanent_delegate.clone()],
        )?;
        msg!("✅ Permanent delegate config initialized");
    }

    if transfer_hook_program_option.is_some() {
        msg!("🔨 STEP 1c: Initializing transfer hook config...");
        let transfer_hook_program = transfer_hook_program_option.unwrap();
        let config_init_idx = spl_token_2022::extension::transfer_hook::instruction::initialize(
            &spl_token_2022::ID,
            &mint_account.key,
            None,
            Some(*transfer_hook_program.key),
        )?;

        invoke(
            &config_init_idx,
            &[
                token_program.clone(),
                mint_account.clone(),
                funding_account.clone(),
                transfer_hook_program.clone(),
            ],
        )?;
        msg!("✅ Transfer hook config initialized");
    }

    // Initialize metadata pointer extension
    msg!("🔨 STEP 1d: Initializing metadata pointer extension...");
    let metadata_config_init_idx =
        spl_token_2022::extension::metadata_pointer::instruction::initialize(
            &spl_token_2022::ID, 
            &mint_account.key, 
            Some(*pda_account.key),
            Some(*mint_account.key)
        )?;

    invoke(
        &metadata_config_init_idx,
        &[token_program.clone(), mint_account.clone()],
    )?;
    msg!("✅ Metadata pointer extension initialized");

    // STEP 2: Initialize mint with initialize_mint2 (Token-2022, no rent sysvar)
    msg!("🔨 STEP 2: Initializing mint with initialize_mint2 (Token-2022, no rent sysvar)...");
    
    // Use initialize_mint2 (NOT initialize_mint) for Token-2022 with extensions
    // initialize_mint references the deprecated Rent sysvar (removed in Solana v1.14+)
    // initialize_mint2 works with extensions when they're initialized first
    // and doesn't require the rent sysvar account (uses default rent exemption internally)
    let mint_idx = spl_token_2022::instruction::initialize_mint2(
        token_program.key,
        mint_account.key,
        pda_account.key, // mint authority (direct reference)
        Some(pda_account.key), // freeze authority (Option)
        token_config.decimals,
    )?;

    invoke(
        &mint_idx, 
        &[
            token_program.clone(), 
            mint_account.clone(),
            pda_account.clone(), // mint authority
        ]
    )?;
    msg!("✅ Mint initialized with extension support");

    // STEP 3: Initialize metadata fields
    msg!("🔨 STEP 3: Initializing metadata fields...");
    
    let name_clone = token_config.name.clone();
    let symbol_clone = token_config.symbol.clone();
    let uri_clone = token_config.uri.clone();
    
    let init_metadata_ix = spl_token_metadata_interface::instruction::initialize(
        &spl_token_2022::id(),
        mint_account.key,
        pda_account.key,
        mint_account.key,
        pda_account.key,
        token_config.name,
        token_config.symbol,
        token_config.uri,
    );
    
    msg!("🔍 Initializing metadata with accounts:");
    msg!("  Mint: {}", mint_account.key);
    msg!("  Update authority (PDA): {}", pda_account.key);
    msg!("  Funding account: {}", funding_account.key);
    msg!("  System program: {}", system_program.key);
    
    // Token Metadata Interface initialize requires:
    // 0. Mint account (writable)
    // 1. Update authority (signer, writable)
    // 2. System program (for account creation if needed)
    invoke_signed(
        &init_metadata_ix,
        &[
            mint_account.clone(),
            pda_account.clone(),
            system_program.clone(),
        ],
        &[&[&token_config.pda.to_le_bytes(), &[pda_bump]]],
    )?;
    
    msg!("✅ Metadata initialized: name='{}', symbol='{}', uri='{}'", 
         name_clone, symbol_clone, uri_clone);

    // create the ATA, this will belong to the pda account
    msg!("🔍 Creating/initializing token account for token account owner...");
    msg!("💰 Before token account creation - Funding account lamports: {}", **funding_account.try_borrow_lamports()?);
    msg!("Creating/initializing Token-2022 token account");
    msg!("  Owner: {}", token_account_owner.key);
    msg!("  Mint: {}", mint_account.key);
    msg!("  Token account: {}", token_account.key);
    
    // Check if token_account is a PDA (not an ATA)
    // If it's a PDA, we need to initialize it manually instead of using check_and_create_ata
    let expected_ata = spl_associated_token_account::get_associated_token_address_with_program_id(
        token_account_owner.key,
        mint_account.key,
        token_program.key,
    );
    
    let is_pda = *token_account.key != expected_ata;
    
    if is_pda {
        msg!("🔍 Token account is a PDA (not an ATA) - initializing manually...");
        // Check if account is already initialized
        let mut needs_initialization = true;
        {
            let account_data = token_account.data.borrow();
            if account_data.len() >= spl_token_2022::state::Account::LEN {
                match StateWithExtensions::<spl_token_2022::state::Account>::unpack(&account_data) {
                    Ok(existing_account) => {
                        if existing_account.base.is_initialized() {
                            msg!("✅ PDA token account data already initialized");
                            needs_initialization = false;
                        } else {
                            msg!("⚠️ PDA token account exists but is not initialized yet");
                        }
                    }
                    Err(err) => {
                        msg!("⚠️ Could not unpack PDA token account (will reinitialize): {:?}", err);
                    }
                }
            } else {
                msg!("⚠️ PDA token account data too small ({} bytes) - needs initialization", account_data.len());
            }
        }
        
        if needs_initialization {
            if let Some(pda_seeds) = token_account_pda_seeds {
                msg!("🔨 Initializing PDA token account manually with provided seeds...");
                let init_ix = spl_token_2022::instruction::initialize_account3(
                    token_program.key,
                    token_account.key,
                    mint_account.key,
                    token_account_owner.key,  // authority
                )?;
                
                // Invoke with PDA seeds
                invoke_signed(
                    &init_ix,
                    &[
                        token_program.clone(),
                        token_account.clone(),
                        mint_account.clone(),
                        token_account_owner.clone(),
                    ],
                    &[pda_seeds],
                )?;
                msg!("✅ PDA token account initialized successfully");
            } else {
                msg!("⚠️ WARNING: Token account is a PDA but no seeds provided - must be initialized by caller");
                msg!("⚠️ Skipping token account initialization - caller must initialize PDA before calling create_2022_token");
                return Err(ProgramError::InvalidAccountData);
            }
        }
        // else already initialized, nothing to do
    } else {
        // It's an ATA, use the normal flow
        utils::check_and_create_ata(funding_account, token_account_owner, mint_account, token_account, token_program, system_program, associated_token_program)?;
    }
    msg!("💰 After token account creation - Token account lamports: {}", **token_account.try_borrow_lamports()?);

    // mint the token to the pda
    msg!("🪙 CRITICAL: Minting tokens:");
    msg!("  token_config.total_supply (raw units): {}", token_config.total_supply);
    msg!("  token_config.decimals: {}", token_config.decimals);
    msg!("  token_config.total_supply (human-readable): {:.9}", 
         token_config.total_supply as f64 / 10_f64.powi(token_config.decimals as i32));
    msg!("  Destination token account: {}", token_account.key);
    msg!("  Mint authority (PDA): {}", pda_account.key);
    
    let mint_to_idx = spl_token_2022::instruction::mint_to_checked(
        token_program.key,
        mint_account.key,
        token_account.key,
        pda_account.key,
        &[pda_account.key],
        token_config.total_supply,
        token_config.decimals,
    )
    .unwrap();
    
    msg!("✅ Mint instruction created successfully");

    msg!("🔄 Executing mint_to_checked instruction...");
    let mint_result = invoke_signed(
        &mint_to_idx,
        &[
            token_program.clone(),
            mint_account.clone(),
            token_account.clone(),
            funding_account.clone(),
            pda_account.clone(),
        ],
        &[&[&token_config.pda.to_le_bytes(), &[pda_bump]]],
    );
    
    match mint_result {
        Ok(_) => {
            msg!("✅ Mint instruction executed successfully");
            
            // Verify mint by checking token account balance
            // For Token-2022, use StateWithExtensions to properly read account data
            let token_balance_after = {
                let account_data = token_account.data.borrow();
                if account_data.len() >= 72 {
                    // Try to parse as Token-2022 account
                    match StateWithExtensions::<spl_token_2022::state::Account>::unpack(&account_data) {
                        Ok(parsed_account) => {
                            msg!("✅ Successfully parsed token account as Token-2022 account");
                            parsed_account.base.amount
                        }
                        Err(e) => {
                            msg!("⚠️ Could not parse as Token-2022 account, trying raw read: {:?}", e);
                            // Fallback to raw read (offset 64 for standard token account)
                            let mut balance_bytes = [0u8; 8];
                            balance_bytes.copy_from_slice(&account_data[64..72]);
                            u64::from_le_bytes(balance_bytes)
                        }
                    }
                } else {
                    msg!("⚠️ Token account data too short: {} bytes", account_data.len());
                    0u64
                }
            };
            
            msg!("🔍 Post-mint balance check:");
            msg!("  token_account balance: {} (raw units)", token_balance_after);
            msg!("  token_account balance: {:.9} (human-readable)", token_balance_after as f64 / 10_f64.powi(token_config.decimals as i32));
            msg!("  Expected: {} (raw units)", token_config.total_supply);
            msg!("  Expected: {:.9} (human-readable)", token_config.total_supply as f64 / 10_f64.powi(token_config.decimals as i32));
            
            if token_balance_after < token_config.total_supply {
                msg!("⚠️ WARNING: Token account balance is less than expected!");
                msg!("  Expected: {} (raw), Got: {} (raw)", token_config.total_supply, token_balance_after);
            } else {
                msg!("✅ Tokens minted successfully to token account");
            }
        }
        Err(e) => {
            msg!("❌ ERROR: Mint failed with error: {:?}", e);
            return Err(e);
        }
    }

    let revoke_authority = spl_token_2022::instruction::set_authority(
        token_program.key,
        mint_account.key,
        None,
        spl_token_2022::instruction::AuthorityType::MintTokens,
        pda_account.key,
        &[pda_account.key],
    )?;

    invoke_signed(
        &revoke_authority,
        &[token_program.clone(), mint_account.clone(), pda_account.clone()],
        &[&[&token_config.pda.to_le_bytes(), &[pda_bump]]],
    )?;

    Ok(())
}
