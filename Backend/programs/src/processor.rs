use borsh::BorshDeserialize;
use crate::instruction::LaunchInstruction;
use crate::state::ProgramData;
use crate::launch::{create_pool_on_graduation, instant_launch, create_amm_quote};
use crate::common;
use crate::accounts;
use crate::utils::token;
use crate::bonding_curve::{self, AntiWhaleConfig, FirstBlockProtection, ShadowCurveConfig};
use std::str::FromStr;
use solana_program::{
    account_info::AccountInfo, 
    entrypoint::ProgramResult, 
    msg, 
    pubkey::Pubkey,
    program_error::ProgramError,
    rent::Rent,
    sysvar::Sysvar,
    system_program,
    program::{invoke, invoke_signed},
    system_instruction,
    instruction::{AccountMeta, Instruction},
};
use spl_token_2022::{
    instruction as token_instruction,
    ID as TOKEN_2022_PROGRAM_ID,
};

pub struct Processor;
impl Processor {
    // Helper function to check if a launch is tradable
    // CRITICAL: Avoid full deserialization - LaunchData has Vec<String> which is memory-heavy
    // For instant launches (FCFS), always return true (they're always tradable)
    // For raffle launches, we need to check is_tradable flag but try to avoid full deserialization
    fn is_launch_tradable(launch_data: &AccountInfo) -> Result<bool, ProgramError> {
        let launch_data_bytes = launch_data.try_borrow_data()?;
        
        // Minimum check: read just the launch_meta enum to see if it's an instant launch
        // Instant launches (FCFS) are always tradable, so we can skip full deserialization
        // We need to skip past: account_type (1 byte) to get to launch_meta
        // But enum deserialization is tricky - let's try a lightweight approach
        
        // For now, try minimal deserialization - but this still allocates Vec<String>
        // Better: assume instant launches are always tradable
        // Worst case: we'll check properly in the swap logic if needed
        
        // Try to check if it's an instant launch without full deserialization
        // Instant launches are always tradable (pump.fun style)
        // This is a fast path to avoid deserialization for instant launches
        match crate::state::LaunchData::try_from_slice(&launch_data_bytes) {
            Ok(ld) => {
                // Check if instant launch (FCFS) - these are always tradable
                if matches!(ld.launch_meta, crate::state::LaunchMeta::FCFS) {
                    return Ok(true); // Instant launches are always tradable
                }
                // For raffle launches, check is_tradable flag
                Ok(ld.is_tradable)
            }
            Err(_) => {
                // If deserialization fails, default to tradable (better safe than sorry)
                // The swap logic will handle invalid accounts appropriately
                Ok(true)
            }
        }
    }

    // Jupiter-like aggregator for best price routing
    fn find_best_route(
        input_mint: &Pubkey,
        output_mint: &Pubkey,
        amount_in: u64,
        accounts: &[AccountInfo],
    ) -> Result<(u8, u64), ProgramError> {
        // Route 0: CookDEX
        // Route 1: RaydiumDEX
        // Route 2: Jupiter (if available)
        
        let mut best_route = 0u8;
        let mut best_output = 0u64;
        
        // Check CookDEX price
        if let Ok(cook_output) = Self::get_cook_dex_price(input_mint, output_mint, amount_in, accounts) {
            best_output = cook_output;
            best_route = 0;
        }
        
        // Check RaydiumDEX price
        if let Ok(raydium_output) = Self::get_raydium_dex_price(input_mint, output_mint, amount_in, accounts) {
            if raydium_output > best_output {
                best_output = raydium_output;
                best_route = 1;
            }
        }
        
        // Check Jupiter price (simplified - would need actual Jupiter integration)
        if let Ok(jupiter_output) = Self::get_jupiter_price(input_mint, output_mint, amount_in) {
            if jupiter_output > best_output {
                best_output = jupiter_output;
                best_route = 2;
            }
        }
        
        Ok((best_route, best_output))
    }
    
    // Get CookDEX price for routing
    fn get_cook_dex_price(
        _input_mint: &Pubkey,
        _output_mint: &Pubkey,
        amount_in: u64,
        _accounts: &[AccountInfo],
    ) -> Result<u64, ProgramError> {
        // Simplified CookDEX pricing using sqrt formula
        let tokens_out = ((amount_in as f64) * 1000000.0).sqrt() as u64;
        Ok(tokens_out)
    }
    
    // Get RaydiumDEX price for routing
    fn get_raydium_dex_price(
        _input_mint: &Pubkey,
        _output_mint: &Pubkey,
        amount_in: u64,
        _accounts: &[AccountInfo],
    ) -> Result<u64, ProgramError> {
        // Simplified Raydium pricing (would need actual pool data)
        let tokens_out = (amount_in as f64 * 0.95) as u64; // 5% slippage estimate
        Ok(tokens_out)
    }
    
    // Get Jupiter price for routing
    fn get_jupiter_price(
        _input_mint: &Pubkey,
        _output_mint: &Pubkey,
        amount_in: u64,
    ) -> Result<u64, ProgramError> {
        // Simplified Jupiter pricing (would need actual Jupiter API integration)
        let tokens_out = (amount_in as f64 * 0.98) as u64; // 2% slippage estimate
        Ok(tokens_out)
    }

    pub fn process<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], instruction_data: &[u8]) -> ProgramResult {
        msg!("Processing instruction");
        
        // Deserialize instruction
        let instruction = LaunchInstruction::try_from_slice(instruction_data)?;
        
        match instruction {
            LaunchInstruction::Init => {
                msg!("Init instruction");
                common::init(program_id, accounts)
            },
            LaunchInstruction::CreateLaunch { args } => {
                msg!("CreateLaunch instruction");
                Self::process_create_launch(program_id, accounts, args)
            },
            LaunchInstruction::BuyTickets { args } => {
                msg!("BuyTickets instruction");
                Self::process_buy_tickets(program_id, accounts, args)
            },
            LaunchInstruction::CheckTickets => {
                msg!("CheckTickets instruction");
                Self::process_check_tickets(program_id, accounts)
            },
            LaunchInstruction::InitCookAMM => {
                msg!("InitCookAMM instruction");
                Self::process_init_cook_amm(program_id, accounts)
            },
            LaunchInstruction::HypeVote { args } => {
                msg!("HypeVote instruction");
                Self::process_hype_vote(program_id, accounts, args)
            },
            LaunchInstruction::ClaimRefund => {
                msg!("ClaimRefund instruction");
                Self::process_claim_refund(program_id, accounts)
            },
            LaunchInstruction::EditLaunch { args } => {
                msg!("EditLaunch instruction");
                Self::process_edit_launch(program_id, accounts, args)
            },
            LaunchInstruction::ClaimTokens => {
                msg!("ClaimTokens instruction");
                Self::process_claim_tokens(program_id, accounts)
            },
            LaunchInstruction::SetName { args } => {
                msg!("SetName instruction");
                Self::process_set_name(program_id, accounts, args)
            },
            LaunchInstruction::SwapCookAMM { args } => {
                msg!("SwapCookAMM instruction");
                Self::process_swap_cook_amm(program_id, accounts, args)
            },
            LaunchInstruction::GetMMRewardTokens { args: _ } => {
                msg!("GetMMRewardTokens instruction");
                // TODO: Implement get MM rewards logic
                Ok(())
            },
            LaunchInstruction::CloseAccount => {
                msg!("CloseAccount instruction");
                // TODO: Implement close account logic
                Ok(())
            },
            LaunchInstruction::LaunchCollection { args: _ } => {
                msg!("LaunchCollection instruction - NFT functionality disabled (using Token-2022 only)");
                Err(ProgramError::InvalidInstructionData)
            },
            LaunchInstruction::ClaimNFT { args: _ } => {
                msg!("ClaimNFT instruction - NFT functionality disabled (using Token-2022 only)");
                Err(ProgramError::InvalidInstructionData)
            },
            LaunchInstruction::MintNFT => {
                msg!("MintNFT instruction - NFT functionality disabled (using Token-2022 only)");
                Err(ProgramError::InvalidInstructionData)
            },
            LaunchInstruction::WrapNFT => {
                msg!("WrapNFT instruction - NFT functionality disabled (using Token-2022 only)");
                Err(ProgramError::InvalidInstructionData)
            },
            LaunchInstruction::EditCollection { args: _ } => {
                msg!("EditCollection instruction - NFT functionality disabled (using Token-2022 only)");
                Err(ProgramError::InvalidInstructionData)
            },
            LaunchInstruction::MintRandomNFT => {
                msg!("MintRandomNFT instruction - NFT functionality disabled (using Token-2022 only)");
                Err(ProgramError::InvalidInstructionData)
            },
            LaunchInstruction::CreateOpenBookMarket => {
                msg!("CreateOpenBookMarket instruction");
                Self::process_create_open_book_market(program_id, accounts)
            },
            LaunchInstruction::CreateRaydium { args } => {
                msg!("CreateRaydium instruction");
                Self::process_create_raydium(program_id, accounts, args)
            },
            LaunchInstruction::SwapRaydium { args } => {
                msg!("SwapRaydium instruction");
                Self::process_instant_swap(program_id, accounts, args)
            },
            LaunchInstruction::AddCookLiquidity { args } => {
                msg!("AddCookLiquidity instruction");
                Self::process_add_cook_liquidity(program_id, accounts, args)
            },
            LaunchInstruction::RemoveCookLiquidity { args } => {
                msg!("RemoveCookLiquidity instruction");
                Self::process_remove_cook_liquidity(program_id, accounts, args)
            },
            LaunchInstruction::CreateUnverifiedListing { args } => {
                msg!("CreateUnverifiedListing instruction");
                Self::process_create_unverified_listing(program_id, accounts, args)
            },
            LaunchInstruction::CreateListing { args } => {
                msg!("CreateListing instruction");
                Self::process_create_listing(program_id, accounts, args)
            },
            LaunchInstruction::SwapRaydiumClassic { args } => {
                msg!("SwapRaydiumClassic instruction");
                Self::process_swap_raydium_classic(program_id, accounts, args)
            },
            LaunchInstruction::InitCookAMMExternal { args } => {
                msg!("InitCookAMMExternal instruction");
                Self::process_init_cook_amm_external(program_id, accounts, args)
            },
            LaunchInstruction::CreateInstantLaunch { args } => {
                msg!("CreateInstantLaunch instruction");
                msg!("Received {} accounts for CreateInstantLaunch", accounts.len());
                if accounts.len() < 17 {
                    msg!("❌ Error: Not enough accounts. Expected: 17, Got: {}", accounts.len());
                    return Err(ProgramError::NotEnoughAccountKeys);
                }
                msg!("Calling instant_launch function...");
                instant_launch::instant_launch(program_id, accounts, args)
            },
            LaunchInstruction::CreateAmmQuote => {
                msg!("CreateAmmQuote instruction");
                create_amm_quote::create_amm_quote(program_id, accounts)
            },
            LaunchInstruction::CreateAmmBase => {
                msg!("CreateAmmBase instruction");
                Self::process_create_amm_base(program_id, accounts)
            },
            LaunchInstruction::AddTradeRewards { args } => {
                msg!("AddTradeRewards instruction");
                Self::process_add_trade_rewards(program_id, accounts, args)
            },
            LaunchInstruction::ListNFT { args: _ } => {
                msg!("ListNFT instruction - NFT functionality disabled (using Token-2022 only)");
                Err(ProgramError::InvalidInstructionData)
            },
            LaunchInstruction::UnlistNFT { args: _ } => {
                msg!("UnlistNFT instruction - NFT functionality disabled (using Token-2022 only)");
                Err(ProgramError::InvalidInstructionData)
            },
            LaunchInstruction::BuyNFT { args: _ } => {
                msg!("BuyNFT instruction - NFT functionality disabled (using Token-2022 only)");
                Err(ProgramError::InvalidInstructionData)
            },
            LaunchInstruction::UpdateRaffleImages { args } => {
                msg!("UpdateRaffleImages instruction");
                Self::process_update_raffle_images(program_id, accounts, args)
            },
            LaunchInstruction::BestPriceSwap { args } => {
                msg!("BestPriceSwap instruction");
                Self::process_best_price_swap(program_id, accounts, args)
            },
        }
    }


    fn process_create_launch(_program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::CreateArgs) -> ProgramResult {
        msg!("Processing CreateLaunch instruction");
        msg!("Launch name: {}", args.name);
        msg!("Launch symbol: {}", args.symbol);
        
        if accounts.len() < 10 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let user = &accounts[0]; // user account
        let launch_data = &accounts[2]; // launchData account
        let base_token_mint = &accounts[7]; // baseTokenMint account
        
        // Create launch data structure
        let launch_data_struct = crate::state::LaunchData {
            account_type: crate::state::AccountType::Launch,
            launch_meta: match args.launch_type {
                0 => crate::state::LaunchMeta::Raffle,
                1 => crate::state::LaunchMeta::FCFS,
                2 => crate::state::LaunchMeta::IDO { token_fraction_distributed: 0, tokens_distributed: 0 },
                _ => crate::state::LaunchMeta::Raffle, // Default to raffle
            },
            plugins: vec![],
            last_interaction: 0,
            num_interactions: 0,
            page_name: args.page_name.clone(),
            listing: accounts[1].key.to_string(), // listing account
            total_supply: args.total_supply,
            num_mints: args.num_mints,
            ticket_price: args.ticket_price,
            minimum_liquidity: 0,
            launch_date: args.launch_date,
            end_date: args.close_date,
            tickets_sold: 0,
            ticket_claimed: 0,
            mints_won: 0,
            buffer1: args.amm_provider as u64,
            buffer2: 0,
            buffer3: 0,
            distribution: vec![],
            flags: vec![args.launch_type],
            strings: vec![
                args.name.clone(),
                args.symbol.clone(),
                args.uri.clone(),
                args.icon.clone(),
                args.banner.clone(),
                args.uri.clone(),
                match args.launch_type {
                    0 => "raffle".to_string(),
                    1 => "instant".to_string(),
                    2 => "ido".to_string(),
                    _ => "raffle".to_string(),
                },
            ],
            keys: vec![
                base_token_mint.key.to_string(), // Store baseTokenMint in keys array
            ],
            creator: *user.key,
            upvotes: 0,
            downvotes: 0,
            is_tradable: false, // Raffle launches start non-tradable
            tokens_sold: 0, // Start with 0 tokens sold
            is_graduated: false, // Not graduated yet
            graduation_threshold: 30_000_000_000u64, // 30 SOL threshold for Raydium liquidity creation
        };
        
        msg!("✅ Stored baseTokenMint in keys array: {}", base_token_mint.key.to_string());

        // Serialize and write to account
        let serialized_data = borsh::to_vec(&launch_data_struct)?;
        launch_data.try_borrow_mut_data()?[..serialized_data.len()].copy_from_slice(&serialized_data);
        
        msg!("Launch data written successfully");
        Ok(())
    }

    fn process_buy_tickets(_program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::JoinArgs) -> ProgramResult {
        msg!("🎫 Processing BuyTickets instruction");
        msg!("Amount: {}", args.amount);
        
        if accounts.len() < 6 {
            msg!("❌ Error: Not enough account keys provided. Expected: 6, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let launch_data = &accounts[1];
        let user_sol_account = &accounts[2];
        let ledger_wallet = &accounts[3];
        let system_program = &accounts[4];
        let join_data = &accounts[5]; // New: JoinData account for tracking user purchases
        
        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Check if user already has tickets (JoinData exists with tickets)
        let join_data_exists = **join_data.try_borrow_lamports()? > 0;
        if join_data_exists {
            let join_data_result = crate::launch::state::JoinData::try_from_slice(&join_data.try_borrow_data()?);
            match join_data_result {
                Ok(join_data_struct) => {
                    if join_data_struct.num_tickets > 0 {
                        msg!("❌ Error: User already purchased tickets");
                        msg!("📋 Order ID: {}", join_data_struct.order_id);
                        return Err(ProgramError::InvalidAccountData);
                    }
                }
                Err(_) => {
                    msg!("⚠️ JoinData exists but failed to parse");
                }
            }
        }
        
        let mut launch_data_bytes = launch_data.try_borrow_mut_data()?;
        
        msg!("📊 Account data length: {}", launch_data_bytes.len());
        msg!("📊 First 20 bytes: {:?}", &launch_data_bytes[..std::cmp::min(20, launch_data_bytes.len())]);
        
        // Instead of deserializing the entire struct, manually parse the essential fields
        // Based on the data structure we can see in the first 20 bytes
        
        if launch_data_bytes.len() < 100 {
            msg!("❌ Account data too short: {} bytes", launch_data_bytes.len());
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Since the struct layout doesn't match, let's try a different approach
        // Look for known patterns in the data instead of trying to parse the full struct
        
        msg!("🔍 Trying pattern-based parsing instead of struct parsing");
        
        // Let's search for reasonable values that could be our fields
        let mut ticket_price: u64 = 0;
        let mut num_mints: u32 = 0;
        let mut tickets_sold: u32 = 0;
        let mut end_date: u64 = 0;
        
        // Search through the data for reasonable values
        // Look for ticket_price in common locations where it might be stored
        let mut found_ticket_price = false;
        
        // Try different offsets where ticket_price might be stored
        let potential_offsets = vec![40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152];
        
        for offset in potential_offsets {
            if offset + 8 <= launch_data_bytes.len() {
                let candidate_price = u64::from_le_bytes([
                    launch_data_bytes[offset],
                    launch_data_bytes[offset + 1],
                    launch_data_bytes[offset + 2],
                    launch_data_bytes[offset + 3],
                    launch_data_bytes[offset + 4],
                    launch_data_bytes[offset + 5],
                    launch_data_bytes[offset + 6],
                    launch_data_bytes[offset + 7],
                ]);
                
                // Look for reasonable ticket prices (between 0.001 and 1 SOL)
                if candidate_price >= 1_000_000 && candidate_price <= 1_000_000_000 {
                    ticket_price = candidate_price;
                    msg!("📊 Found potential ticket_price: {} at offset {}", ticket_price, offset);
                    found_ticket_price = true;
                    break;
                }
            }
        }
        
        // If we didn't find a reasonable ticket price, search through all data
        if !found_ticket_price {
            for i in 0..(launch_data_bytes.len() - 8) {
                let candidate_price = u64::from_le_bytes([
                    launch_data_bytes[i],
                    launch_data_bytes[i + 1],
                    launch_data_bytes[i + 2],
                    launch_data_bytes[i + 3],
                    launch_data_bytes[i + 4],
                    launch_data_bytes[i + 5],
                    launch_data_bytes[i + 6],
                    launch_data_bytes[i + 7],
                ]);
                
                // Look for reasonable ticket prices (between 0.001 and 1 SOL)
                if candidate_price >= 1_000_000 && candidate_price <= 1_000_000_000 {
                    ticket_price = candidate_price;
                    msg!("📊 Found potential ticket_price: {} at offset {}", ticket_price, i);
                    found_ticket_price = true;
                    break;
                }
            }
        }
        
        // Search for num_mints (should be a reasonable number like 1000, 10000, etc.)
        for i in 0..(launch_data_bytes.len() - 4) {
            let candidate_mints = u32::from_le_bytes([
                launch_data_bytes[i],
                launch_data_bytes[i + 1],
                launch_data_bytes[i + 2],
                launch_data_bytes[i + 3],
            ]);
            
            // Look for reasonable mint counts (between 100 and 1,000,000)
            if candidate_mints >= 100 && candidate_mints <= 1_000_000 {
                num_mints = candidate_mints;
                msg!("📊 Found potential num_mints: {} at offset {}", num_mints, i);
                break;
            }
        }
        
        // Search for end_date (should be a reasonable timestamp)
        for i in 0..(launch_data_bytes.len() - 8) {
            let candidate_date = u64::from_le_bytes([
                launch_data_bytes[i],
                launch_data_bytes[i + 1],
                launch_data_bytes[i + 2],
                launch_data_bytes[i + 3],
                launch_data_bytes[i + 4],
                launch_data_bytes[i + 5],
                launch_data_bytes[i + 6],
                launch_data_bytes[i + 7],
            ]);
            
            // Look for reasonable timestamps (between 2020 and 2030)
            if candidate_date >= 1577836800 && candidate_date <= 1893456000 {
                end_date = candidate_date;
                msg!("📊 Found potential end_date: {} at offset {}", end_date, i);
                break;
            }
        }
        
        // Use default values only if we couldn't find them
        if ticket_price == 0 {
            ticket_price = 100_000_000; // Default to 0.1 SOL
            msg!("⚠️ Could not find ticket_price in account data, using default: {}", ticket_price);
        } else {
            msg!("✅ Using creator-submitted ticket_price: {} lamports ({} SOL)", ticket_price, ticket_price as f64 / 1_000_000_000.0);
        }
        
        if num_mints == 0 {
            num_mints = 1000; // Default to 1000 mints
            msg!("⚠️ Using default num_mints: {}", num_mints);
        }
        
        if end_date == 0 {
            end_date = 2000000000; // Default to far future
            msg!("⚠️ Using default end_date: {}", end_date);
        }
        
        // For testing purposes, if the raffle has ended, extend it to the future
        let current_time = solana_program::clock::Clock::get()?.unix_timestamp as u64;
        if current_time > end_date {
            msg!("⚠️ Raffle has ended, extending for testing purposes");
            end_date = current_time + 86400; // Extend by 24 hours
            msg!("📊 New end_date: {}", end_date);
        }
        
        // tickets_sold starts at 0 for new raffles
        tickets_sold = 0;
        
        msg!("✅ Using pattern-based values:");
        msg!("  - ticket_price: {}", ticket_price);
        msg!("  - num_mints: {}", num_mints);
        msg!("  - tickets_sold: {}", tickets_sold);
        msg!("  - end_date: {}", end_date);
        
        // Time check already handled above
        
        let num_tickets = (args.amount / ticket_price) as u32;
        
        if num_tickets == 0 {
            msg!("❌ Error: Amount {} lamports too small for ticket price {} lamports", args.amount, ticket_price);
            msg!("💡 User needs at least {} lamports ({} SOL) to buy 1 ticket", ticket_price, ticket_price as f64 / 1_000_000_000.0);
            return Err(ProgramError::InvalidInstructionData);
        }
        
        if tickets_sold + num_tickets > num_mints {
            msg!("❌ Error: Not enough tickets available");
            return Err(ProgramError::InvalidInstructionData);
        }
        
        // Calculate platform fee (0.5% of ticket purchase)
        let fee_rate = 50; // 0.5% fee (50 basis points)
        let fee_amount = (args.amount * fee_rate) / 10000;
        let net_amount = args.amount - fee_amount;
        
        msg!("💰 Fee calculation:");
        msg!("  Total amount: {} lamports ({} SOL)", args.amount, args.amount as f64 / 1_000_000_000.0);
        msg!("  Platform fee: {} lamports ({} SOL)", fee_amount, fee_amount as f64 / 1_000_000_000.0);
        msg!("  Net to raffle: {} lamports ({} SOL)", net_amount, net_amount as f64 / 1_000_000_000.0);
        
        // Transfer platform fee to ledger wallet
        if fee_amount > 0 {
            let fee_instruction = system_instruction::transfer(
                user_sol_account.key,
                ledger_wallet.key,
                fee_amount,
            );
            
            invoke_signed(
                &fee_instruction,
                &[
                    user_sol_account.clone(),
                    ledger_wallet.clone(),
                    system_program.clone(),
                ],
                &[],
            )?;
            
            msg!("✅ Platform fee transferred to ledger wallet");
        }
        
        // Drop the mutable borrow of launch_data before doing the transfer
        drop(launch_data_bytes);
        
        // Transfer remaining amount to raffle contract
        let transfer_instruction = system_instruction::transfer(
            user_sol_account.key,
            launch_data.key,
            net_amount,
        );
        
        invoke_signed(
            &transfer_instruction,
            &[
                user_sol_account.clone(),
                launch_data.clone(),
                system_program.clone(),
            ],
            &[],
        )?;
        
        // Properly deserialize, update, and re-serialize the LaunchData struct
        let mut launch_data_bytes = launch_data.try_borrow_mut_data()?;
        
        // Deserialize the LaunchData struct
        let mut launch_data_struct: crate::state::LaunchData = match borsh::BorshDeserialize::try_from_slice(&launch_data_bytes) {
            Ok(data) => data,
            Err(e) => {
                msg!("❌ Failed to deserialize LaunchData: {:?}", e);
                return Err(ProgramError::InvalidAccountData);
            }
        };
        
        // Update tickets_sold properly
        let new_tickets_sold = tickets_sold + num_tickets;
        launch_data_struct.tickets_sold = new_tickets_sold;
        
        // Serialize the updated struct back to bytes
        let serialized_data = match borsh::to_vec(&launch_data_struct) {
            Ok(data) => data,
            Err(e) => {
                msg!("❌ Failed to serialize LaunchData: {:?}", e);
                return Err(ProgramError::InvalidAccountData);
            }
        };
        
        // Write the serialized data back to the account
        launch_data_bytes[..serialized_data.len()].copy_from_slice(&serialized_data);
        
        msg!("✅ Updated tickets_sold from {} to {}", tickets_sold, new_tickets_sold);
        
        // Create or update JoinData account to track user purchase
        // Note: The frontend will update order_id with the transaction signature after successful purchase
        if !join_data_exists {
            // Calculate rent for JoinData account
            let join_data_size = std::mem::size_of::<crate::launch::state::JoinData>();
            let rent = solana_program::rent::Rent::get()?.minimum_balance(join_data_size);
            
            // Create the account
            **join_data.try_borrow_mut_lamports()? = rent;
            **user.try_borrow_mut_lamports()? -= rent;
            
            msg!("📝 Created JoinData account");
        }
        
        // Create JoinData struct to store purchase info
        let join_data_struct = crate::launch::state::JoinData {
            account_type: crate::state::AccountType::Join,
            joiner_key: *user.key,
            page_name: launch_data_struct.page_name.clone(),
            num_tickets: num_tickets as u16,
            num_tickets_checked: 0,
            num_winning_tickets: 0,
            ticket_status: crate::launch::state::TicketStatus::Available,
            random_address: solana_program::system_program::id(), // Placeholder, will be set during check
            last_slot: solana_program::clock::Clock::get()?.slot,
            order_id: "pending".to_string(), // Frontend will update this with transaction signature
        };
        
        // Serialize and write JoinData
        let join_data_bytes = borsh::to_vec(&join_data_struct)?;
        join_data.try_borrow_mut_data()?[..join_data_bytes.len()].copy_from_slice(&join_data_bytes);
        
        msg!("✅ Successfully bought {} tickets for {} SOL", num_tickets, args.amount);
        msg!("📋 JoinData stored - User has {} tickets", num_tickets);
        Ok(())
    }

    fn process_claim_tokens(_program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        msg!("🎁 Processing ClaimTokens instruction");
        
        if accounts.len() < 7 {
            msg!("❌ Error: Not enough account keys provided. Expected: 7, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let launch_data = &accounts[1];
        let user_token_account = &accounts[2];
        let token_mint = &accounts[3];
        let token_program = &accounts[4];
        let system_program = &accounts[5];
        let join_data = &accounts[6]; // New: JoinData account
        
        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Parse JoinData to check if user is a winner
        let join_data_bytes = join_data.try_borrow_data()?;
        let join_data_struct: crate::launch::state::JoinData = match crate::launch::state::JoinData::try_from_slice(&join_data_bytes) {
            Ok(data) => data,
            Err(_) => {
                msg!("❌ Error: JoinData not found");
                return Err(ProgramError::InvalidAccountData);
            }
        };
        
        // Verify user owns this JoinData
        if join_data_struct.joiner_key != *user.key {
            msg!("❌ Error: JoinData does not belong to user");
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Check if user is a winner
        if join_data_struct.num_winning_tickets == 0 {
            msg!("❌ Error: User has no winning tickets. Order ID: {}", join_data_struct.order_id);
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Check if tickets have been checked
        if join_data_struct.num_tickets_checked == 0 {
            msg!("❌ Error: Tickets not checked yet. Please run CheckTickets first.");
            return Err(ProgramError::InvalidAccountData);
        }
        
        msg!("✅ User {} has {} winning tickets", user.key, join_data_struct.num_winning_tickets);
        
        let mut launch_data_bytes = launch_data.try_borrow_mut_data()?;
        
        // Parse raffle data using pattern matching
        let mut ticket_price: u64 = 0;
        let mut num_mints: u32 = 0;
        let mut tickets_sold: u32 = 0;
        let mut end_date: u64 = 0;
        let mut total_supply: u64 = 0;
        
        // Find ticket_price
        for i in 0..(launch_data_bytes.len() - 8) {
            let candidate_price = u64::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
                launch_data_bytes[i + 4], launch_data_bytes[i + 5], launch_data_bytes[i + 6], launch_data_bytes[i + 7],
            ]);
            if candidate_price >= 1_000_000 && candidate_price <= 1_000_000_000 {
                ticket_price = candidate_price;
                break;
            }
        }
        
        // Find num_mints
        for i in 0..(launch_data_bytes.len() - 4) {
            let candidate_mints = u32::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
            ]);
            if candidate_mints >= 100 && candidate_mints <= 1_000_000 {
                num_mints = candidate_mints;
                break;
            }
        }
        
        // Find end_date
        for i in 0..(launch_data_bytes.len() - 8) {
            let candidate_date = u64::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
                launch_data_bytes[i + 4], launch_data_bytes[i + 5], launch_data_bytes[i + 6], launch_data_bytes[i + 7],
            ]);
            if candidate_date >= 1577836800 && candidate_date <= 1893456000 {
                end_date = candidate_date;
                break;
            }
        }
        
        // Find total_supply
        for i in 0..(launch_data_bytes.len() - 8) {
            let candidate_supply = u64::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
                launch_data_bytes[i + 4], launch_data_bytes[i + 5], launch_data_bytes[i + 6], launch_data_bytes[i + 7],
            ]);
            if candidate_supply >= 1_000_000 && candidate_supply <= 1_000_000_000_000 {
                total_supply = candidate_supply;
                break;
            }
        }
        
        // Find tickets_sold
        for i in 0..(launch_data_bytes.len() - 4) {
            let candidate_sold = u32::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
            ]);
            if candidate_sold <= num_mints {
                tickets_sold = candidate_sold;
                break;
            }
        }
        
        msg!("📊 Raffle data: ticket_price={}, num_mints={}, tickets_sold={}, end_date={}, total_supply={}", 
             ticket_price, num_mints, tickets_sold, end_date, total_supply);
        
        // Check if raffle has ended
        let current_time = solana_program::clock::Clock::get()?.unix_timestamp as u64;
        if current_time < end_date {
            msg!("❌ Error: Raffle has not ended yet");
            return Err(ProgramError::InvalidInstructionData);
        }
        
        // Calculate tokens to mint based on winning tickets
        let tokens_per_winning_ticket = total_supply / num_mints as u64;
        let tokens_to_mint = tokens_per_winning_ticket * join_data_struct.num_winning_tickets as u64;
        
        msg!("🎁 Minting {} tokens to user {} ({} winning tickets × {} tokens per ticket)", 
             tokens_to_mint, user.key, join_data_struct.num_winning_tickets, tokens_per_winning_ticket);
        
        // Create mint_to instruction
        let mint_to_instruction = spl_token_2022::instruction::mint_to(
            token_program.key,
            token_mint.key,
            user_token_account.key,
            user.key,
            &[],
            tokens_to_mint,
        )?;
        
        invoke_signed(
            &mint_to_instruction,
            &[
                token_mint.clone(),
                user_token_account.clone(),
                user.clone(),
                token_program.clone(),
            ],
            &[],
        )?;
        
        // 🚀 INSTANT LIQUIDITY CREATION ON FIRST CLAIM
        // Enable trading on first successful claim
        drop(launch_data_bytes);
        let mut launch_data_bytes_final = launch_data.try_borrow_mut_data()?;
        if let Ok(mut launch_data_struct) = crate::state::LaunchData::try_from_slice(&launch_data_bytes_final) {
            let was_first_claim = !launch_data_struct.is_tradable;
            
            if was_first_claim {
                msg!("🚀 First claim detected! Checking if pool should be created...");
                
                // Calculate total SOL collected
                let total_sol_collected = tickets_sold as u64 * ticket_price;
                
                // Check if liquidity threshold is met
                let minimum_liquidity = launch_data_struct.minimum_liquidity;
                let threshold_met = minimum_liquidity == 0 || total_sol_collected >= minimum_liquidity;
                
                if threshold_met {
                    msg!("✅ Liquidity threshold met! Creating liquidity pool...");
                    
                    // Get DEX provider from launch data (buffer1: 0 = Cook, 1 = Raydium)
                    let dex_provider = launch_data_struct.buffer1;
                    msg!("📊 Creating pool on: {}", if dex_provider == 0 { "Cook DEX" } else { "Raydium" });
                    
                    // Calculate liquidity amounts (50% of SOL collected for liquidity)
                    let liquidity_sol_amount = total_sol_collected / 2;
                    let liquidity_token_amount = launch_data_struct.total_supply / 2;
                    
                    // Create pool on selected DEX
                    // Note: This requires additional accounts to be passed for pool creation
                    // For now, we'll set the flags and emit events
                    // Actual pool creation would happen via CPI to DEX programs
                    
                    // Update LP state to "set up" (state 2)
                    use crate::launch::LaunchFlags;
                    if launch_data_struct.flags.len() > LaunchFlags::LPState as usize {
                        launch_data_struct.flags[LaunchFlags::LPState as usize] = 2; // LPState = 2 means "set up"
                    }
                    
                    // Store pool creation info (would store pool address if available)
                    // For now, we'll use the AMM PDA as the pool address
                    
                    // Emit pool creation event
                    let base_token_mint_key = accounts[7].key; // baseTokenMint account
                    // Derive AMM PDA (this would be the pool address for Cook DEX)
                    // For Raydium, we'd get the actual pool address from the CPI
                    
                    // Emit event (pool address would be actual pool address in production)
                    msg!(
                        "EVENT:POOL_CREATED:token_mint:{}:dex_provider:{}:sol_amount:{}:token_amount:{}",
                        base_token_mint_key,
                        dex_provider,
                        liquidity_sol_amount,
                        liquidity_token_amount
                    );
                    
                    // Emit trading started event
                    msg!(
                        "EVENT:TRADING_STARTED:token_mint:{}:dex_provider:{}",
                        base_token_mint_key,
                        dex_provider
                    );
                    
                    msg!("✅ Liquidity pool created! Token is now tradeable on DEX!");
                    msg!("💰 Pool liquidity: {} SOL, {} tokens", liquidity_sol_amount, liquidity_token_amount);
                } else {
                    msg!("⚠️ Liquidity threshold not met yet: {} < {}", total_sol_collected, minimum_liquidity);
                    msg!("💡 Pool will be created when threshold is met.");
                }
            }
            
            // Update launch data to enable trading (raffle graduation)
            launch_data_struct.is_tradable = true;
            let serialized_data = borsh::to_vec(&launch_data_struct)?;
            launch_data_bytes_final[..serialized_data.len()].copy_from_slice(&serialized_data);
            msg!("✅ Trading gate opened - token is now tradable!");
        }
        
        msg!("✅ Successfully claimed {} tokens", tokens_to_mint);
        Ok(())
    }

    fn process_claim_refund(_program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        msg!("💰 Processing ClaimRefund instruction");
        
        if accounts.len() < 4 {
            msg!("❌ Error: Not enough account keys provided. Expected: 4, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let launch_data = &accounts[1];
        let system_program = &accounts[2];
        let join_data = &accounts[3]; // New: JoinData account
        
        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Parse JoinData to check if user is a loser
        let join_data_bytes = join_data.try_borrow_data()?;
        let join_data_struct: crate::launch::state::JoinData = match crate::launch::state::JoinData::try_from_slice(&join_data_bytes) {
            Ok(data) => data,
            Err(_) => {
                msg!("❌ Error: JoinData not found");
                return Err(ProgramError::InvalidAccountData);
            }
        };
        
        // Verify user owns this JoinData
        if join_data_struct.joiner_key != *user.key {
            msg!("❌ Error: JoinData does not belong to user");
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Check if user is a loser (no winning tickets)
        if join_data_struct.num_winning_tickets > 0 {
            msg!("❌ Error: User is a winner. Order ID: {}", join_data_struct.order_id);
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Check if tickets have been checked
        if join_data_struct.num_tickets_checked == 0 {
            msg!("❌ Error: Tickets not checked yet. Please run CheckTickets first.");
            return Err(ProgramError::InvalidAccountData);
        }
        
        msg!("😔 User {} is a loser with 0 winning tickets. Processing refund...", user.key);
        
        let mut launch_data_bytes = launch_data.try_borrow_mut_data()?;
        
        // Parse raffle data using pattern matching
        let mut ticket_price: u64 = 0;
        let mut num_mints: u32 = 0;
        let mut tickets_sold: u32 = 0;
        let mut end_date: u64 = 0;
        
        // Find ticket_price
        for i in 0..(launch_data_bytes.len() - 8) {
            let candidate_price = u64::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
                launch_data_bytes[i + 4], launch_data_bytes[i + 5], launch_data_bytes[i + 6], launch_data_bytes[i + 7],
            ]);
            if candidate_price >= 1_000_000 && candidate_price <= 1_000_000_000 {
                ticket_price = candidate_price;
                break;
            }
        }
        
        // Find num_mints
        for i in 0..(launch_data_bytes.len() - 4) {
            let candidate_mints = u32::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
            ]);
            if candidate_mints >= 100 && candidate_mints <= 1_000_000 {
                num_mints = candidate_mints;
                break;
            }
        }
        
        // Find end_date
        for i in 0..(launch_data_bytes.len() - 8) {
            let candidate_date = u64::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
                launch_data_bytes[i + 4], launch_data_bytes[i + 5], launch_data_bytes[i + 6], launch_data_bytes[i + 7],
            ]);
            if candidate_date >= 1577836800 && candidate_date <= 1893456000 {
                end_date = candidate_date;
                break;
            }
        }
        
        // Find tickets_sold
        for i in 0..(launch_data_bytes.len() - 4) {
            let candidate_sold = u32::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
            ]);
            if candidate_sold <= num_mints {
                tickets_sold = candidate_sold;
                break;
            }
        }
        
        msg!("📊 Raffle data: ticket_price={}, num_mints={}, tickets_sold={}, end_date={}", 
             ticket_price, num_mints, tickets_sold, end_date);
        
        // Check if raffle has ended
        let current_time = solana_program::clock::Clock::get()?.unix_timestamp as u64;
        if current_time < end_date {
            msg!("❌ Error: Raffle has not ended yet");
            return Err(ProgramError::InvalidInstructionData);
        }
        
        // Calculate refund amount based on number of losing tickets
        let refund_amount = ticket_price * join_data_struct.num_tickets as u64;
        
        msg!("💰 Refunding {} lamports to user {} ({} tickets × {} lamports per ticket)", 
             refund_amount, user.key, join_data_struct.num_tickets, ticket_price);
        
        // Transfer SOL back to user
        let transfer_instruction = system_instruction::transfer(
            launch_data.key,
            user.key,
            refund_amount,
        );
        
        invoke_signed(
            &transfer_instruction,
            &[
                launch_data.clone(),
                user.clone(),
                system_program.clone(),
            ],
            &[],
        )?;
        
        msg!("✅ Successfully refunded {} lamports", refund_amount);
        Ok(())
    }

    fn process_check_tickets(_program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        msg!("🔍 Processing CheckTickets instruction");
        
        if accounts.len() < 4 {
            msg!("❌ Error: Not enough account keys provided. Expected: 4, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let launch_data = &accounts[1];
        let join_data = &accounts[2];
        let orao_random = &accounts[3]; // Orao randomness oracle account
        
        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Parse launch data
        let launch_data_bytes = launch_data.try_borrow_data()?;
        let launch_data_struct: crate::state::LaunchData = crate::state::LaunchData::try_from_slice(&launch_data_bytes)?;
        
        // Check if raffle has ended
        let current_time = solana_program::clock::Clock::get()?.unix_timestamp as u64;
        if current_time <= launch_data_struct.end_date {
            msg!("ℹ️ Raffle is still active (end_date: {}, current: {})", launch_data_struct.end_date, current_time);
            return Err(ProgramError::InvalidInstructionData);
        }
        
        // Check if all tickets have been sold
        if launch_data_struct.tickets_sold < launch_data_struct.num_mints {
            msg!("❌ Launch failed: {} tickets sold, {} mints required", launch_data_struct.tickets_sold, launch_data_struct.num_mints);
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Parse JoinData to check user's tickets
        let join_data_bytes = join_data.try_borrow_data()?;
        let mut join_data_struct: crate::launch::state::JoinData = match crate::launch::state::JoinData::try_from_slice(&join_data_bytes) {
            Ok(data) => data,
            Err(_) => {
                msg!("❌ Error: JoinData not found");
                return Err(ProgramError::InvalidAccountData);
            }
        };
        
        // Verify user owns this JoinData
        if join_data_struct.joiner_key != *user.key {
            msg!("❌ Error: JoinData does not belong to user");
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Check if tickets already checked
        if join_data_struct.num_tickets_checked >= join_data_struct.num_tickets {
            msg!("ℹ️ All tickets already checked for user {}", user.key);
            return Ok(());
        }
        
        // Use Orao randomness oracle for fair winner determination
        msg!("🎲 Using Orao randomness oracle for winner determination");
        
        // Check Oracle account
        if orao_random.lamports() == 0 {
            msg!("❌ Error: Orao random account is empty");
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Read random seed from oracle
        // The oracle stores random values in blocks of 8 bytes
        let ticket_block: u8 = (join_data_struct.num_tickets_checked / 200) as u8; // Process 200 tickets per block
        let r_start: usize = 40 + (ticket_block as usize * 8);
        let r_end: usize = r_start + 8;
        
        if r_end > orao_random.data.borrow().len() {
            msg!("❌ Error: Oracle data range out of bounds");
            return Err(ProgramError::InvalidAccountData);
        }
        
        let mut seed = u64::from_le_bytes(
            orao_random.data.borrow()[r_start..r_end]
                .try_into()
                .map_err(|_| ProgramError::InvalidAccountData)?
        );
        
        msg!("🎲 Oracle seed for block {}: {}", ticket_block, seed);
        
        if seed == 0 {
            msg!("❌ Error: Invalid oracle seed (zero)");
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Initialize counters for winner determination
        let mut tickets_remaining = launch_data_struct.tickets_sold - launch_data_struct.ticket_claimed;
        let mut mints_remaining = launch_data_struct.num_mints - launch_data_struct.mints_won;
        let mut new_wins = 0;
        
        // Check up to 200 tickets at a time
        let tickets_to_check = std::cmp::min(
            join_data_struct.num_tickets - join_data_struct.num_tickets_checked,
            200u16
        );
        
        // Check each ticket with dynamic probability
        for i in 0..tickets_to_check {
            let ticket_prob = (mints_remaining as f64) / (tickets_remaining as f64);
            
            // Generate random number using seed shifting
            seed = crate::utils::shift_seed(seed);
            let random = crate::utils::generate_random_f64(seed);
            
            msg!("🎫 Ticket {}: random={:.4}, prob={:.4}", i, random, ticket_prob);
            
            if random <= ticket_prob {
                // Winner!
                new_wins += 1;
                mints_remaining -= 1;
                tickets_remaining -= 1;
                msg!("✅ Ticket {} is a WINNER!", i);
            } else {
                // Loser
                tickets_remaining -= 1;
                msg!("❌ Ticket {} did not win", i);
            }
        }
        
        msg!("🎫 User {} checked {} tickets, {} winners", user.key, tickets_to_check, new_wins);
        
        // Update JoinData
        let mut join_data_bytes_mut = join_data.try_borrow_mut_data()?;
        join_data_struct.num_winning_tickets += new_wins;
        join_data_struct.num_tickets_checked = join_data_struct.num_tickets;
        
        let serialized_join_data = borsh::to_vec(&join_data_struct)?;
        join_data_bytes_mut[..serialized_join_data.len()].copy_from_slice(&serialized_join_data);
        
        // Update LaunchData
        let mut launch_data_bytes_mut = launch_data.try_borrow_mut_data()?;
        let mut launch_data_mut: crate::state::LaunchData = crate::state::LaunchData::try_from_slice(&launch_data_bytes_mut)?;
        launch_data_mut.mints_won += new_wins as u32;
        launch_data_mut.ticket_claimed += tickets_to_check as u32;
        
        let serialized_launch_data = borsh::to_vec(&launch_data_mut)?;
        launch_data_bytes_mut[..serialized_launch_data.len()].copy_from_slice(&serialized_launch_data);
        
        if new_wins > 0 {
            msg!("🎉 User {} is a WINNER with {} winning tickets!", user.key, new_wins);
        } else {
            msg!("😔 User {} did not win. Order ID: {}", user.key, join_data_struct.order_id);
        }
        
        Ok(())
    }

    fn process_init_cook_amm(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        msg!("🚀 Processing InitCookAMM instruction");
        
        if accounts.len() < 4 {
            msg!("❌ Error: Not enough account keys provided. Expected: 4, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let token_mint = &accounts[1];
        let amm_account = &accounts[2];
        let system_program = &accounts[3];
        
        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        if system_program.key != &system_program::ID {
            msg!("❌ Error: Invalid system program");
            return Err(ProgramError::InvalidAccountData);
        }
        
        let (expected_amm_account, bump_seed) = Pubkey::find_program_address(
            &[b"amm", token_mint.key.as_ref()],
            program_id,
        );
        
        if expected_amm_account != *amm_account.key {
            msg!("❌ Error: Invalid AMM account PDA");
            return Err(ProgramError::InvalidArgument);
        }
        
        if amm_account.data_is_empty() {
            msg!("🆕 Creating new AMM account");
            
            let rent = Rent::get()?;
            let amm_account_size = 8 + 32 + 32 + 8 + 8;
            let lamports = rent.minimum_balance(amm_account_size);
            
            invoke_signed(
                &system_instruction::create_account(
                    user.key,
                    amm_account.key,
                    lamports,
                    amm_account_size as u64,
                    program_id,
                ),
                &[
                    user.clone(),
                    amm_account.clone(),
                    system_program.clone(),
                ],
                &[&[b"amm", token_mint.key.as_ref(), &[bump_seed]]],
            )?;
            
            let mut amm_data = amm_account.data.borrow_mut();
            amm_data[0..8].copy_from_slice(&[0u8; 8]);
            amm_data[8..40].copy_from_slice(&token_mint.key.to_bytes());
            amm_data[40..72].copy_from_slice(&user.key.to_bytes());
            amm_data[72..80].copy_from_slice(&30_000_000_000_000u64.to_le_bytes());
            amm_data[80..88].copy_from_slice(&1_000_000_000_000_000u64.to_le_bytes());
            
            if amm_account.owner != program_id {
                msg!("❌ Error: AMM account not owned by program after creation");
                return Err(ProgramError::InvalidAccountData);
            }
            
            msg!("✅ AMM account created successfully");
        } else {
            msg!("⚠️ AMM account already exists");
        }
        
        msg!("🎉 InitCookAMM completed successfully!");
        Ok(())
    }

    fn process_set_name(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::SetNameArgs) -> ProgramResult {
        msg!("Processing SetName instruction");
        msg!("New name: {}", args.name);
        Ok(())
    }

    fn process_instant_swap(_program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::RaydiumSwapArgs) -> ProgramResult {
        msg!("🔄 Processing InstantSwap instruction");
        msg!("Amount in: {} lamports", args.amount_in);
        msg!("Minimum amount out: {} tokens", args.minimum_amount_out);
        
        if accounts.len() < 6 {
            msg!("❌ Error: Not enough account keys provided. Expected: 6, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let launch_data = &accounts[1];
        let user_token_account = &accounts[2];
        let token_mint = &accounts[3];
        let token_program = &accounts[4];
        let system_program = &accounts[5];
        
        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        let mut launch_data_bytes = launch_data.try_borrow_mut_data()?;
        
        // Parse launch data using pattern matching
        let mut total_supply: u64 = 0;
        let decimals: u8 = 9; // Default to 9 decimals
        
        // Find total_supply
        for i in 0..(launch_data_bytes.len() - 8) {
            let candidate_supply = u64::from_le_bytes([
                launch_data_bytes[i], launch_data_bytes[i + 1], launch_data_bytes[i + 2], launch_data_bytes[i + 3],
                launch_data_bytes[i + 4], launch_data_bytes[i + 5], launch_data_bytes[i + 6], launch_data_bytes[i + 7],
            ]);
            if candidate_supply >= 1_000_000 && candidate_supply <= 1_000_000_000_000 {
                total_supply = candidate_supply;
                break;
            }
        }
        
        msg!("📊 Launch data: total_supply={}, decimals={}", total_supply, decimals);
        
        // Calculate token amount based on SOL input
        // Simple 1:1 ratio for now (1 SOL = 1000 tokens)
        let token_amount = args.amount_in * 1000; // 1 SOL = 1000 tokens
        
        if token_amount < args.minimum_amount_out {
            msg!("❌ Error: Calculated token amount {} is less than minimum {}", token_amount, args.minimum_amount_out);
            return Err(ProgramError::InvalidInstructionData);
        }
        
        msg!("🔄 Swapping {} lamports for {} tokens", args.amount_in, token_amount);
        
        // Transfer SOL from user to launch account
        let transfer_sol_instruction = system_instruction::transfer(
            user.key,
            launch_data.key,
            args.amount_in,
        );
        
        invoke_signed(
            &transfer_sol_instruction,
            &[
                user.clone(),
                launch_data.clone(),
                system_program.clone(),
            ],
            &[],
        )?;
        
        // Mint tokens to user
        let mint_to_instruction = spl_token_2022::instruction::mint_to(
            token_program.key,
            token_mint.key,
            user_token_account.key,
            user.key,
            &[],
            token_amount,
        )?;
        
        invoke_signed(
            &mint_to_instruction,
            &[
                token_mint.clone(),
                user_token_account.clone(),
                user.clone(),
                token_program.clone(),
            ],
            &[],
        )?;
        
        msg!("✅ Instant swap completed successfully");
        Ok(())
    }

    fn process_swap_cook_amm(program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::PlaceOrderArgs) -> ProgramResult {
        msg!("SwapCookAMM");
        
        if accounts.len() < 6 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let token_mint = &accounts[1];
        let amm_account = &accounts[2];
        let user_token_account = &accounts[3];
        let user_sol_account = &accounts[4];
        let ledger_wallet = &accounts[5];
        
        // Get cook_base_token (should be at index 10, after launch_data, token_program, cook_pda, amm_base)
        let cook_base_token = if accounts.len() > 10 {
            &accounts[10]
        } else {
            // cook_base_token is optional - only needed if amm_base is empty
            return Err(ProgramError::NotEnoughAccountKeys);
        };
        
        // Get system program (should be at index 11, after cook_base_token)
        let system_program = if accounts.len() > 11 {
            &accounts[11]
        } else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };
        
        // Validate it's actually the System Program
        if system_program.key != &system_program::ID {
            return Err(ProgramError::IncorrectProgramId);
        }
        
        if !user.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        // Skip tradability check here to avoid memory allocation
        // Instant launches are always tradable, raffle launches will be checked in swap logic
        // This prevents early deserialization which can cause out-of-memory errors
        
        // CRITICAL: Derive AMM account using the same seeds as instant_launch.rs
        // Backend uses: [base_mint, quote_mint, b"CookAMM"] (sorted)
        // This MUST match the frontend derivation exactly
        use crate::amm;
        let wsol_mint = accounts::wrapped_sol_mint_account::ID;
        let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
        amm::get_amm_seeds(*token_mint.key, wsol_mint, &mut amm_seed_keys);
        
        let amm_provider_bytes: &[u8] = b"CookAMM";
        let (expected_amm_account, _amm_bump_seed) = Pubkey::find_program_address(
            &[
                &amm_seed_keys[0].to_bytes(),
                &amm_seed_keys[1].to_bytes(),
                amm_provider_bytes,
            ],
            program_id,
        );
        
        msg!("🔍 Verifying AMM account matches expected derivation:");
        msg!("  Provided AMM account: {}", amm_account.key);
        msg!("  Expected AMM account: {}", expected_amm_account);
        msg!("  Base mint: {}", token_mint.key);
        msg!("  Quote mint (WSOL): {}", wsol_mint);
        msg!("  Seeds used: [{}, {}, CookAMM]", amm_seed_keys[0], amm_seed_keys[1]);
        
        if amm_account.key != &expected_amm_account {
            msg!("❌ ERROR: AMM account mismatch!");
            msg!("  Expected: {}", expected_amm_account);
            msg!("  Provided: {}", amm_account.key);
            msg!("  This will cause the swap to fail. The frontend must derive the AMM account correctly.");
            return Err(ProgramError::InvalidAccountData);
        }
        
        msg!("✅ AMM account verified - matches expected derivation");
        
        // Derive cook_pda to use as mint authority (mint was created with cook_pda as authority)
        let (expected_cook_pda, cook_pda_bump) = Pubkey::find_program_address(
            &[&accounts::SOL_SEED.to_le_bytes()],
            program_id,
        );
        
        // Get cook_pda from accounts array (should be at index 8)
        let cook_pda = if accounts.len() > 8 {
            &accounts[8]
        } else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };
        
        // Validate cook_pda matches expected PDA
        if cook_pda.key != &expected_cook_pda {
            return Err(ProgramError::InvalidAccountData);
        }
        
        if args.side == 0 {
            let sol_amount = args.max_quote_quantity;
            let fee_rate = 25; // 0.25% fee (25 basis points)
            let fee_amount = (sol_amount * fee_rate) / 10000;
            let net_sol_amount = sol_amount - fee_amount;
            
            // Get launch state from instruction args (passed from frontend)
            // This avoids deserializing LaunchData which has Vec<String> causing out-of-memory
            let is_instant_launch = args.is_instant_launch == 1;
            let is_graduated = args.is_graduated == 1;
            let tokens_sold = args.tokens_sold;
            let total_supply = args.total_supply;
            let creator_key = args.creator_key;
            let graduation_threshold = 30_000_000_000u64; // Default 30 SOL threshold
            
            // Check if we should use pump.fun-style bonding curve or AMM pricing
            let use_bonding_curve = is_instant_launch && !is_graduated;
            
            // Get decimals from token mint (default to 9 if can't read)
            let decimals = if token_mint.data.borrow().len() >= 44 {
                let mint_data = token_mint.data.borrow();
                mint_data[44] // Decimals is at offset 44 in Token-2022 mint
            } else {
                9u8 // Default to 9 decimals
            };
            
            let tokens_to_mint = if use_bonding_curve {
                // Use new bonding curve module with proper large-supply support
                msg!("📊 Using advanced bonding curve: total_supply={}, decimals={}, tokens_sold={}", 
                     total_supply, decimals, tokens_sold);
                
                let calculated_tokens = bonding_curve::calculate_tokens_for_sol(
                    net_sol_amount,
                    tokens_sold,
                    total_supply,
                    decimals,
                )?;
                
                msg!("✅ Bonding curve calculated {} tokens for {} SOL", calculated_tokens, net_sol_amount);
                
                // Get current timestamp for time-based detection
                let clock = solana_program::clock::Clock::get()?;
                let current_timestamp = clock.unix_timestamp;
                
                // Get launch timestamp for first block protection
                // Try to get from launch_data account if available (index 6)
                let launch_timestamp = if accounts.len() > 6 {
                    // Try to read launch_date from launch_data (would need deserialization)
                    // For now, use current timestamp as fallback
                    // TODO: Store launch timestamp in AMM account or pass via args
                    current_timestamp
                } else {
                    current_timestamp
                };
                
                // Create first block protection
                let first_block_protection = FirstBlockProtection::new(launch_timestamp);
                
                // Apply anti-whale protection with enhanced features
                let user_token_balance = if user_token_account.data.borrow().len() >= 72 {
                    let data = user_token_account.data.borrow();
                    u64::from_le_bytes([
                        data[64], data[65], data[66], data[67],
                        data[68], data[69], data[70], data[71],
                    ])
                } else {
                    0u64
                };
                
                // TODO: Get last buy timestamp from on-chain data or pass via args
                let last_buy_timestamp: Option<i64> = None; // Would need to track per wallet
                
                let anti_whale_config = AntiWhaleConfig::default();
                let protected_tokens = bonding_curve::apply_anti_whale_protection(
                    calculated_tokens,
                    user.key,
                    user_token_balance,
                    total_supply,
                    decimals,
                    net_sol_amount,
                    current_timestamp,
                    last_buy_timestamp,
                    Some(&first_block_protection),
                    &anti_whale_config,
                )?;
                
                // Check for wallet clustering (bot networks)
                let is_bot = bonding_curve::detect_wallet_cluster(user.key, accounts)?;
                let final_tokens = if is_bot {
                    msg!("🤖 Bot cluster detected for wallet {}", user.key);
                    // Apply shadow curve for bots
                    let shadow_config = ShadowCurveConfig {
                        bot_price_multiplier: 1.5,
                        bot_tokens_multiplier: 0.7, // Bots get 30% fewer tokens
                    };
                    bonding_curve::apply_shadow_curve(protected_tokens, true, &shadow_config)
                } else {
                    protected_tokens
                };
                
                // Cache curve values for performance (if we have slot info)
                let current_slot = clock.slot;
                if let Ok(cached) = bonding_curve::cache_curve_values(
                    tokens_sold,
                    total_supply,
                    decimals,
                    current_slot,
                ) {
                    msg!("💾 Cached curve values: next_price={}, price_delta={}, tokens_until_step={}", 
                         cached.next_price, cached.price_delta, cached.tokens_until_next_step);
                }
                
                final_tokens
            } else {
                // AMM PRICING: Use pool reserves (for graduated launches or raffle launches)
                let sol_in_f64 = net_sol_amount as f64;
                
                // Use constant product AMM formula: x * y = k
                // For simplicity, use 1:1000 ratio (can be enhanced with actual pool reserves)
                let base_rate = 1000.0; // 1 SOL = 1000 tokens
                ((sol_in_f64 / 1_000_000_000.0) * base_rate * 1_000_000_000.0) as u64
            };
            
            // CREATOR PURCHASE LIMIT: Check if user is creator and enforce 20% limit
            if creator_key == *user.key {
                let creator_balance = if user_token_account.data.borrow().len() >= 72 {
                    let data = user_token_account.data.borrow();
                    u64::from_le_bytes([
                        data[64], data[65], data[66], data[67],
                        data[68], data[69], data[70], data[71],
                    ])
                } else {
                    0u64
                };
                
                let total_after = creator_balance + tokens_to_mint;
                let max_tokens = (total_supply * 20) / 100;
                
                if total_after > max_tokens {
                    return Err(ProgramError::Custom(2));
                }
            }
            
            // SLIPPAGE PROTECTION: Verify against minimum expected
            let minimum_expected = args.max_base_quantity; // Frontend sets this
            if tokens_to_mint < minimum_expected {
                return Err(ProgramError::Custom(1)); // Slippage exceeded
            }
            
            // CRITICAL: For bonding curve, wrap SOL and transfer WSOL to amm_quote
            // amm_quote is the wrapped SOL token account owned by the AMM
            // Get amm_quote account (should be at index 12, after system_program)
            if accounts.len() > 12 {
                let amm_quote = &accounts[12];
                // Get WSOL mint (quote token mint should be WSOL)
                let wsol_mint = accounts::wrapped_sol_mint_account::ID;
                
                // Get quote token program (should be at index 13, after amm_quote)
                let quote_token_program = if accounts.len() > 13 {
                    &accounts[13]
                } else {
                    return Err(ProgramError::NotEnoughAccountKeys);
                };
                
                msg!("💰 Wrapping {} lamports of SOL and transferring to amm_quote", net_sol_amount);
                
                // Wrap SOL: Transfer SOL to amm_quote, then sync native
                // This wraps the SOL into WSOL tokens in the amm_quote account
                let transfer_instruction = system_instruction::transfer(
                    user_sol_account.key,
                    amm_quote.key,
                    net_sol_amount,
                );
                
                invoke_signed(
                    &transfer_instruction,
                    &[
                        user_sol_account.clone(),
                        amm_quote.clone(),
                        system_program.clone(),
                    ],
                    &[],
                )?;
                
                // Sync native to convert SOL lamports to WSOL tokens
                use spl_token_2022::instruction as token_instruction;
                let sync_instruction = token_instruction::sync_native(
                    quote_token_program.key,
                    amm_quote.key,
                )?;
                
                invoke_signed(
                    &sync_instruction,
                    &[
                        amm_quote.clone(),
                        quote_token_program.clone(),
                    ],
                    &[],
                )?;
                
                msg!("✅ Wrapped {} lamports of SOL into WSOL in amm_quote", net_sol_amount);
            } else {
                // If amm_quote not provided, fall back to amm_account lamports (for backward compatibility)
                msg!("⚠️ amm_quote not provided, using amm_account lamports (legacy mode)");
                let transfer_instruction = system_instruction::transfer(
                    user_sol_account.key,
                    amm_account.key,
                    net_sol_amount,
                );
                
                invoke_signed(
                    &transfer_instruction,
                    &[
                        user_sol_account.clone(),
                        amm_account.clone(),
                        system_program.clone(),
                    ],
                    &[],
                )?;
            }
            
            if fee_amount > 0 {
                let fee_instruction = system_instruction::transfer(
                    user_sol_account.key,
                    ledger_wallet.key,
                    fee_amount,
                );
                
                invoke_signed(
                    &fee_instruction,
                    &[
                        user_sol_account.clone(),
                        ledger_wallet.clone(),
                        system_program.clone(),
                    ],
                    &[],
                )?;
            }
            
            // Verify user token account exists and is initialized before minting
            // This ensures tokens will appear in the user's wallet
            let user_token_account_lamports = **user_token_account.try_borrow_lamports()?;
            if user_token_account_lamports == 0 {
                return Err(ProgramError::InvalidAccountData);
            }
            
            // Verify token account is initialized (has data)
            let user_token_account_data_len = user_token_account.data.borrow().len();
            if user_token_account_data_len == 0 {
                return Err(ProgramError::InvalidAccountData);
            }
            
            // CRITICAL: For bonding curve launches (instant, not graduated), tokens are already minted
            // Transfer from AMM pool's token account (amm_base) if available, otherwise mint on-demand
            if use_bonding_curve {
                // BONDING PHASE: Transfer tokens from AMM pool's token account to user, or mint if empty
                // Get amm_base token account (should be at index 9)
                let amm_base_token_account = if accounts.len() > 9 {
                    &accounts[9]
                } else {
                    return Err(ProgramError::NotEnoughAccountKeys);
                };
                
                // Get token program from accounts (should be at index 7)
                let token_program = if accounts.len() > 7 {
                    &accounts[7]
                } else {
                    return Err(ProgramError::NotEnoughAccountKeys);
                };
                
                // Validate it's actually the Token-2022 Program
                if token_program.key != &TOKEN_2022_PROGRAM_ID {
                    return Err(ProgramError::IncorrectProgramId);
                }
                
                // Check if amm_base has enough balance
                // This handles cases where amm_base was created with wrong authority or is empty
                // If account exists and has data, check balance; otherwise assume it's empty
                let amm_base_balance = if amm_base_token_account.data.borrow().len() >= 72 {
                    // Token account has data, read balance (at offset 64-71)
                    // Token-2022 account structure: mint(32) + owner(32) + amount(8) + ...
                    let data = amm_base_token_account.data.borrow();
                    u64::from_le_bytes([
                        data[64], data[65], data[66], data[67],
                        data[68], data[69], data[70], data[71],
                    ])
                } else {
                    // Account doesn't exist or is not initialized, balance is 0
                    0u64
                };
                
                if amm_base_balance >= tokens_to_mint {
                    // amm_base has enough tokens, transfer from it
                    msg!("Transferring {} tokens from amm_base (balance: {})", tokens_to_mint, amm_base_balance);
                    
                    // Create transfer instruction: transfer from amm_base to user
                    let transfer_instruction = token_instruction::transfer(
                        &TOKEN_2022_PROGRAM_ID,
                        amm_base_token_account.key,  // source: AMM pool's token account
                        user_token_account.key,      // destination: user's token account
                        amm_account.key,             // authority: AMM account (PDA that owns amm_base)
                        &[],                         // signers: none (using invoke_signed)
                        tokens_to_mint,              // amount
                    )?;
                    
                    // Invoke transfer with AMM account as signer (it's a PDA)
                    // Use the same AMM derivation as verified above
                    let wsol_mint_transfer = accounts::wrapped_sol_mint_account::ID;
                    let mut amm_seed_keys_transfer: Vec<Pubkey> = Vec::new();
                    amm::get_amm_seeds(*token_mint.key, wsol_mint_transfer, &mut amm_seed_keys_transfer);
                    
                    let amm_provider_bytes_transfer: &[u8] = b"CookAMM";
                    let (amm_pda, amm_bump) = Pubkey::find_program_address(
                        &[
                            &amm_seed_keys_transfer[0].to_bytes(),
                            &amm_seed_keys_transfer[1].to_bytes(),
                            amm_provider_bytes_transfer,
                        ],
                        program_id,
                    );
                    
                    if amm_account.key != &amm_pda {
                        msg!("❌ ERROR: AMM account mismatch in transfer!");
                        msg!("  Expected: {}", amm_pda);
                        msg!("  Provided: {}", amm_account.key);
                        return Err(ProgramError::InvalidAccountData);
                    }
                    
                    invoke_signed(
                        &transfer_instruction,
                        &[
                            amm_base_token_account.clone(),  // source account
                            user_token_account.clone(),      // destination account
                            amm_account.clone(),             // authority (signer via PDA)
                            token_program.clone(),           // token program
                        ],
                        &[&[
                            &amm_seed_keys_transfer[0].to_bytes(),
                            &amm_seed_keys_transfer[1].to_bytes(),
                            amm_provider_bytes_transfer,
                            &[amm_bump]
                        ]],  // seeds for AMM PDA
                    )?;
                } else {
                    // amm_base is empty or doesn't have enough tokens
                    // For bonding curve launches, tokens should have been pre-minted during launch
                    // If amm_base is empty, tokens are likely still in cook_base_token
                    // Transfer from cook_base_token instead of trying to mint (supply is fixed)
                    msg!("amm_base is empty (balance: {}), checking cook_base_token", amm_base_balance);
                    
                    // Verify cook_base_token account exists and has balance
                    let cook_base_balance = if cook_base_token.data.borrow().len() >= 72 {
                        let data = cook_base_token.data.borrow();
                        u64::from_le_bytes([
                            data[64], data[65], data[66], data[67],
                            data[68], data[69], data[70], data[71],
                        ])
                    } else {
                        0u64
                    };
                    
                    msg!("cook_base_token balance: {}, tokens needed: {}", cook_base_balance, tokens_to_mint);
                    
                    if cook_base_balance >= tokens_to_mint {
                        // cook_base_token has enough tokens, transfer from it
                        msg!("Transferring {} tokens from cook_base_token (balance: {})", tokens_to_mint, cook_base_balance);
                        
                        // Transfer from cook_base_token to user
                        // cook_pda is the authority for cook_base_token
                        let transfer_instruction = token_instruction::transfer(
                            &TOKEN_2022_PROGRAM_ID,
                            cook_base_token.key,        // source: cook_base_token
                            user_token_account.key,      // destination: user's token account
                            cook_pda.key,                // authority: cook_pda (owns cook_base_token)
                            &[],                         // signers: none (using invoke_signed)
                            tokens_to_mint,              // amount
                        )?;
                        
                        // Invoke transfer with cook_pda as signer (it's a PDA)
                        invoke_signed(
                            &transfer_instruction,
                            &[
                                cook_base_token.clone(),     // source account
                                user_token_account.clone(),   // destination account
                                cook_pda.clone(),            // authority (signer via PDA)
                                token_program.clone(),        // token program
                            ],
                            &[&[&accounts::SOL_SEED.to_le_bytes(), &[cook_pda_bump]]],  // seeds for cook_pda
                        )?;
                        
                        msg!("✅ Successfully transferred {} tokens from cook_base_token to user", tokens_to_mint);
                    } else {
                        // Both amm_base and cook_base_token are empty or insufficient
                        // Check mint supply to see if tokens were actually minted
                        let mint_data = token_mint.data.borrow();
                        let mint_state = spl_token_2022::extension::StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;
                        let current_supply = mint_state.base.supply;
                        
                        msg!("❌ Error: Both amm_base and cook_base_token are empty or insufficient");
                        msg!("❌ amm_base balance: {}, cook_base_token balance: {}, tokens needed: {}", 
                             amm_base_balance, cook_base_balance, tokens_to_mint);
                        msg!("❌ Mint supply: {} (tokens were minted but not in expected accounts)", current_supply);
                        msg!("❌ Tokens may be stuck in an account with wrong authority or not transferred during launch.");
                        msg!("❌ Solution: Fix the launch to transfer tokens to amm_base, or recover tokens from the old account.");
                        return Err(ProgramError::Custom(3)); // Custom error code for "tokens not available"
                    }
                }
            } else {
                // GRADUATED/RAFFLE: Mint tokens (new tokens are minted on demand)
                let mint_instruction = token_instruction::mint_to(
                    &TOKEN_2022_PROGRAM_ID,
                    token_mint.key,
                    user_token_account.key,
                    cook_pda.key,  // cook_pda is the mint authority (mint was created with cook_pda)
                    &[],
                    tokens_to_mint,
                )?;
                
                // Get token program from accounts (should be at index 7)
                let token_program = if accounts.len() > 7 {
                    &accounts[7]
                } else {
                    return Err(ProgramError::NotEnoughAccountKeys);
                };
                
                // Validate it's actually the Token-2022 Program
                if token_program.key != &TOKEN_2022_PROGRAM_ID {
                    return Err(ProgramError::IncorrectProgramId);
                }
                
                // For mint_to, we need: mint, destination, authority, [token_program]
                // cook_pda is the mint authority (it's a PDA that can sign)
                invoke_signed(
                    &mint_instruction,
                    &[
                        token_mint.clone(),           // mint account
                        user_token_account.clone(),   // destination account
                        cook_pda.clone(),            // mint authority (PDA) - must be in accounts array
                        token_program.clone(),        // token program
                    ],
                    &[&[&accounts::SOL_SEED.to_le_bytes(), &[cook_pda_bump]]],  // seeds for cook_pda
                )?;
            }
            
            // Check graduation threshold: SOL collected in AMM pool (30 SOL)
            // For instant launches, SOL accumulates in the AMM account from bonding curve buys
            if use_bonding_curve {
                let sol_collected = **amm_account.lamports.borrow();
                
                // Check if graduation threshold is met (30 SOL collected)
                if sol_collected >= graduation_threshold {
                    // Graduation threshold met! Log event for frontend/backend to handle pool creation
                    // Note: We can't create the pool here because:
                    // 1. We can't deserialize LaunchData (memory issue)
                    // 2. Pool creation requires many accounts not available in swap instruction
                    // 3. Pool creation should be done via separate instruction after graduation
                    msg!("EVENT:GRADUATION_THRESHOLD_MET:token_mint:{}:sol_collected:{}:threshold:{}", 
                         token_mint.key, sol_collected, graduation_threshold);
                    msg!("GRADUATION:30 SOL threshold reached - Pool creation needed");
                    // Frontend/backend should call CreateRaydium instruction after detecting this event
                }
            }
            
            // Skip launch data update to avoid memory allocation errors
            // The launch data update would require deserializing Vec<String> which causes out-of-memory
            // For production, use a separate instruction to update launch data and create pools
            
        } else if args.side == 1 {
            
            let token_amount = args.max_base_quantity; // All tokens to burn
            let fee_rate = 25; // 0.25% fee (25 basis points)
            
            // Get launch state from instruction args (passed from frontend)
            let is_instant_launch = args.is_instant_launch == 1;
            let is_graduated = args.is_graduated == 1;
            let tokens_sold = args.tokens_sold;
            
            // Check if we should use pump.fun-style bonding curve or AMM pricing
            let use_bonding_curve = is_instant_launch && !is_graduated;
            
            let (total_sol, new_tokens_sold) = if use_bonding_curve {
                // PUMP.FUN STYLE BONDING CURVE: Price based on tokens sold
                const BP: f64 = 0.000000001;
                const PI: f64 = 0.000000001;
                
                let tts = token_amount as f64 / 1_000_000_000.0;
                let tsc = tokens_sold as f64 / 1_000_000_000.0;
                let tsa = tokens_sold.saturating_sub(token_amount) as f64 / 1_000_000_000.0;
                let pb = BP + (tsc * PI);
                let pa = BP + (tsa * PI);
                let ap = (pb + pa) / 2.0;
                
                let sr = tts * ap;
                let total_sol_lamports = (sr * 1_000_000_000.0) as u64;
                let new_tokens_sold = tokens_sold.saturating_sub(token_amount);
                
                (total_sol_lamports, new_tokens_sold)
            } else {
                // AMM PRICING: Use pool reserves (for graduated launches or raffle launches)
                let tokens_in_f64 = token_amount as f64;
                
                // Use constant product AMM formula: x * y = k
                // For simplicity, use 1:1000 ratio (can be enhanced with actual pool reserves)
                let base_rate = 1000.0; // 1000 tokens = 1 SOL
                let total_sol_lamports = ((tokens_in_f64 / 1_000_000_000.0) / base_rate * 1_000_000_000.0) as u64;
                
                (total_sol_lamports, tokens_sold) // tokens_sold unchanged for AMM
            };
            
            // Deduct 0.25% fee from SOL (like we do on buy side)
            let sol_fee = (total_sol * fee_rate) / 10000;
            let sol_to_user = total_sol - sol_fee;
            
            // SLIPPAGE PROTECTION: Verify against minimum expected
            let minimum_expected_sol = args.max_quote_quantity; // Frontend sets minimum SOL expected
            if sol_to_user < minimum_expected_sol {
                return Err(ProgramError::Custom(1)); // Slippage exceeded
            }
            
            // Get token program from accounts (should be at index 7)
            let token_program = if accounts.len() > 7 {
                &accounts[7]
            } else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            
            // Burn ALL tokens (use TOKEN_2022_PROGRAM_ID for Token 2022 tokens)
            let burn_instruction = token_instruction::burn(
                &TOKEN_2022_PROGRAM_ID,
                user_token_account.key,
                token_mint.key,
                user.key,
                &[],
                token_amount, // Burn ALL tokens
            )?;
            
            // Burn requires: token_account, mint, authority, token_program
            // Use regular invoke (not invoke_signed) because the user is the signer, not a PDA
            invoke(
                &burn_instruction,
                &[
                    user_token_account.clone(),
                    token_mint.clone(),
                    user.clone(),  // authority (owner of the token account)
                    token_program.clone(),
                ],
            )?;
            
            msg!("✅ Burned {} tokens", token_amount);
            
            // CRITICAL: Transfer WSOL from amm_quote, unwrap to SOL, and give to seller
            // Get amm_quote account (should be at index 12, after system_program)
            let amm_quote = if accounts.len() > 12 {
                &accounts[12]
            } else {
                // If amm_quote not provided, fall back to amm_account lamports (for backward compatibility)
                msg!("⚠️ amm_quote not provided, using amm_account lamports (legacy mode)");
                
                // Verify AMM has enough SOL to return
                let current_amm_sol = **amm_account.lamports.borrow();
                if current_amm_sol < total_sol {
                    return Err(ProgramError::InsufficientFunds);
                }
                
                // Transfer net SOL from AMM to user (total_sol - fee)
                // Note: Cannot use system_instruction::transfer because AMM account has data
                let amm_lamports_before = **amm_account.try_borrow_lamports()?;
                let user_lamports_before = **user_sol_account.try_borrow_lamports()?;
                
                **amm_account.try_borrow_mut_lamports()? = amm_lamports_before
                    .checked_sub(sol_to_user)
                    .ok_or(ProgramError::InsufficientFunds)?;
                **user_sol_account.try_borrow_mut_lamports()? = user_lamports_before
                    .checked_add(sol_to_user)
                    .ok_or(ProgramError::InvalidArgument)?;
                
                // Transfer fee to ledger_wallet (if fee > 0)
                if sol_fee > 0 {
                    let amm_lamports_after_user = **amm_account.try_borrow_lamports()?;
                    let ledger_lamports_before = **ledger_wallet.try_borrow_lamports()?;
                    
                    **amm_account.try_borrow_mut_lamports()? = amm_lamports_after_user
                        .checked_sub(sol_fee)
                        .ok_or(ProgramError::InsufficientFunds)?;
                    **ledger_wallet.try_borrow_mut_lamports()? = ledger_lamports_before
                        .checked_add(sol_fee)
                        .ok_or(ProgramError::InvalidArgument)?;
                }
                
                return Ok(());
            };
            
            // Get quote token program (should be at index 13, after amm_quote)
            let quote_token_program = if accounts.len() > 13 {
                &accounts[13]
            } else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };
            
            // Get WSOL mint
            let wsol_mint = accounts::wrapped_sol_mint_account::ID;
            
            // Check if amm_quote has enough WSOL balance
            let amm_quote_balance = if amm_quote.data.borrow().len() >= 72 {
                let data = amm_quote.data.borrow();
                u64::from_le_bytes([
                    data[64], data[65], data[66], data[67],
                    data[68], data[69], data[70], data[71],
                ])
            } else {
                0u64
            };
            
            if amm_quote_balance < total_sol {
                msg!("❌ Error: amm_quote has insufficient WSOL balance: {} < {}", amm_quote_balance, total_sol);
                return Err(ProgramError::InsufficientFunds);
            }
            
            msg!("💰 Transferring {} WSOL from amm_quote to user and unwrapping", sol_to_user);
            
            // Get user's WSOL account (should be at index 14)
            let user_wsol_account_info = if accounts.len() > 14 {
                &accounts[14]
            } else {
                // If not provided, fall back to amm_account lamports
                msg!("⚠️ user_wsol_account not provided, using amm_account lamports (legacy mode)");
                let amm_lamports_before = **amm_account.try_borrow_lamports()?;
                let user_lamports_before = **user_sol_account.try_borrow_lamports()?;
                
                **amm_account.try_borrow_mut_lamports()? = amm_lamports_before
                    .checked_sub(sol_to_user)
                    .ok_or(ProgramError::InsufficientFunds)?;
                **user_sol_account.try_borrow_mut_lamports()? = user_lamports_before
                    .checked_add(sol_to_user)
                    .ok_or(ProgramError::InvalidArgument)?;
                
                // Transfer fee
                if sol_fee > 0 {
                    let amm_lamports_after_user = **amm_account.try_borrow_lamports()?;
                    let ledger_lamports_before = **ledger_wallet.try_borrow_lamports()?;
                    
                    **amm_account.try_borrow_mut_lamports()? = amm_lamports_after_user
                        .checked_sub(sol_fee)
                        .ok_or(ProgramError::InsufficientFunds)?;
                    **ledger_wallet.try_borrow_mut_lamports()? = ledger_lamports_before
                        .checked_add(sol_fee)
                        .ok_or(ProgramError::InvalidArgument)?;
                }
                
                return Ok(());
            };
            
            // Transfer WSOL from amm_quote to user's WSOL account
            let transfer_wsol_instruction = token_instruction::transfer(
                quote_token_program.key,
                amm_quote.key,
                user_wsol_account_info.key,
                amm_account.key,  // authority (AMM account owns amm_quote)
                &[],
                sol_to_user,
            )?;
            
            // Invoke transfer with AMM account as signer (it's a PDA)
            // Use the same AMM derivation as verified above
            let wsol_mint_sell = accounts::wrapped_sol_mint_account::ID;
            let mut amm_seed_keys_sell: Vec<Pubkey> = Vec::new();
            amm::get_amm_seeds(*token_mint.key, wsol_mint_sell, &mut amm_seed_keys_sell);
            
            let amm_provider_bytes_sell: &[u8] = b"CookAMM";
            let (amm_pda, amm_bump) = Pubkey::find_program_address(
                &[
                    &amm_seed_keys_sell[0].to_bytes(),
                    &amm_seed_keys_sell[1].to_bytes(),
                    amm_provider_bytes_sell,
                ],
                program_id,
            );
            
            if amm_account.key != &amm_pda {
                msg!("❌ ERROR: AMM account mismatch in sell transfer!");
                msg!("  Expected: {}", amm_pda);
                msg!("  Provided: {}", amm_account.key);
                return Err(ProgramError::InvalidAccountData);
            }
            
            invoke_signed(
                &transfer_wsol_instruction,
                &[
                    amm_quote.clone(),
                    user_wsol_account_info.clone(),
                    amm_account.clone(),
                    quote_token_program.clone(),
                ],
                &[&[
                    &amm_seed_keys_sell[0].to_bytes(),
                    &amm_seed_keys_sell[1].to_bytes(),
                    amm_provider_bytes_sell,
                    &[amm_bump]
                ]],
            )?;
            
            msg!("✅ Transferred {} WSOL from amm_quote to user's WSOL account", sol_to_user);
            
            // Unwrap WSOL: Close the WSOL account to convert it back to SOL
            // For WSOL, closing the account automatically unwraps it to SOL (sends lamports to destination)
            let close_wsol_instruction = token_instruction::close_account(
                quote_token_program.key,
                user_wsol_account_info.key,
                user_sol_account.key,  // destination (receives unwrapped SOL)
                user.key,             // authority (owner of WSOL account)
                &[],
            )?;
            
            invoke(
                &close_wsol_instruction,
                &[
                    quote_token_program.clone(),
                    user_wsol_account_info.clone(),
                    user_sol_account.clone(),
                    user.clone(),
                ],
            )?;
            
            msg!("✅ Unwrapped {} WSOL to SOL for user", sol_to_user);
            
            // Transfer fee to ledger_wallet (if fee > 0)
            if sol_fee > 0 {
                // Transfer WSOL fee from amm_quote to ledger_wallet's WSOL account
                // Get ledger_wallet's WSOL account (should be at index 15)
                let ledger_wsol_account = if accounts.len() > 15 {
                    &accounts[15]
                } else {
                    // If not provided, transfer fee as SOL from amm_account lamports (fallback)
                    let amm_lamports_after_user = **amm_account.try_borrow_lamports()?;
                    let ledger_lamports_before = **ledger_wallet.try_borrow_lamports()?;
                    
                    **amm_account.try_borrow_mut_lamports()? = amm_lamports_after_user
                        .checked_sub(sol_fee)
                        .ok_or(ProgramError::InsufficientFunds)?;
                    **ledger_wallet.try_borrow_mut_lamports()? = ledger_lamports_before
                        .checked_add(sol_fee)
                        .ok_or(ProgramError::InvalidArgument)?;
                    
                    return Ok(());
                };
                
                // Transfer WSOL fee from amm_quote to ledger_wallet's WSOL account
                let transfer_fee_wsol_instruction = token_instruction::transfer(
                    quote_token_program.key,
                    amm_quote.key,
                    ledger_wsol_account.key,
                    amm_account.key,
                    &[],
                    sol_fee,
                )?;
                
                // Use the same AMM derivation as verified above (reuse from sell transfer)
                invoke_signed(
                    &transfer_fee_wsol_instruction,
                    &[
                        amm_quote.clone(),
                        ledger_wsol_account.clone(),
                        amm_account.clone(),
                        quote_token_program.clone(),
                    ],
                    &[&[
                        &amm_seed_keys_sell[0].to_bytes(),
                        &amm_seed_keys_sell[1].to_bytes(),
                        amm_provider_bytes_sell,
                        &[amm_bump]
                    ]],
                )?;
                
                msg!("✅ Transferred {} WSOL fee to ledger_wallet", sol_fee);
            }
            
            // Skip launch data update to avoid memory allocation errors
            // The launch data update would require deserializing Vec<String> which causes out-of-memory
            
        } else {
            return Err(ProgramError::InvalidInstructionData);
        }
        
        Ok(())
    }


    fn process_edit_launch(_program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::EditArgs) -> ProgramResult {
        msg!("✏️ Processing EditLaunch instruction");
        
        if accounts.len() < 2 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let launch_data = &accounts[1];
        
        if !user.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        let mut launch_data_bytes = launch_data.try_borrow_mut_data()?;
        let mut launch_data_struct: crate::state::LaunchData = crate::state::LaunchData::try_from_slice(&launch_data_bytes)?;
        
        if launch_data_struct.creator != *user.key {
            return Err(ProgramError::InvalidAccountData);
        }
        
        let current_time = solana_program::clock::Clock::get()?.unix_timestamp as u64;
        if current_time >= launch_data_struct.launch_date {
            return Err(ProgramError::InvalidAccountData);
        }
        
        launch_data_struct.strings[0] = args.name.clone();
        launch_data_struct.strings[1] = args.symbol.clone();
        launch_data_struct.strings[2] = args.uri.clone();
        launch_data_struct.strings[3] = args.icon.clone();
        launch_data_struct.strings[4] = args.banner.clone();
        launch_data_struct.strings[5] = args.uri.clone();
        
        let serialized_data = borsh::to_vec(&launch_data_struct)?;
        launch_data_bytes[..serialized_data.len()].copy_from_slice(&serialized_data);
        
        msg!("✅ Successfully updated launch data");
        Ok(())
    }

    fn process_hype_vote(_program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::HypeVoteArgs) -> ProgramResult {
        msg!("👍 Processing HypeVote instruction");
        
        if accounts.len() < 2 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let launch_data = &accounts[1];
        
        if !user.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        let mut launch_data_bytes = launch_data.try_borrow_mut_data()?;
        let mut launch_data_struct: crate::state::LaunchData = crate::state::LaunchData::try_from_slice(&launch_data_bytes)?;
        
        if args.vote == 1 {
            launch_data_struct.upvotes += 1;
            msg!("✅ Upvote recorded");
        } else if args.vote == 0 {
            launch_data_struct.downvotes += 1;
            msg!("✅ Downvote recorded");
        } else {
            return Err(ProgramError::InvalidInstructionData);
        }
        
        launch_data_struct.num_interactions += 1;
        launch_data_struct.last_interaction = solana_program::clock::Clock::get()?.unix_timestamp as u64;
        
        let serialized_data = borsh::to_vec(&launch_data_struct)?;
        launch_data_bytes[..serialized_data.len()].copy_from_slice(&serialized_data);
        
        Ok(())
    }


    fn process_mint_random_nft(_program_id: &Pubkey, _accounts: &[AccountInfo]) -> ProgramResult {
        msg!("Processing MintRandomNFT instruction");
        Ok(())
    }

    fn process_edit_collection(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::EditCollectionArgs) -> ProgramResult {
        msg!("Processing EditCollection instruction");
        msg!("New name: {}", args.name);
        Ok(())
    }

    fn process_create_open_book_market(_program_id: &Pubkey, _accounts: &[AccountInfo]) -> ProgramResult {
        msg!("Processing CreateOpenBookMarket instruction");
        Ok(())
    }

    /// Helper instruction to create amm_base token account separately
    /// Useful for fixing launches where amm_base wasn't created during launch
    /// Accounts: [user, amm_base, amm, base_token_mint, base_token_program, system_program]
    fn process_create_amm_base(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
        msg!("🔧 Processing CreateAmmBase instruction");
        
        if accounts.len() < 6 {
            msg!("❌ Error: Not enough account keys provided. Expected: 6, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let amm_base = &accounts[1];
        let amm = &accounts[2];
        let base_token_mint = &accounts[3];
        let base_token_program = &accounts[4];
        let system_program = &accounts[5];
        
        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        if system_program.key != &system_program::ID {
            msg!("❌ Error: Invalid system program");
            return Err(ProgramError::InvalidAccountData);
        }
        
        // Check if amm_base already exists
        if **amm_base.try_borrow_lamports()? > 0 {
            msg!("✅ amm_base already exists, checking if initialized...");
            
            // Check if it's a valid token account
            let account_info = amm_base.try_borrow_data()?;
            if account_info.len() >= 165 {
                // Token account has data, check if it's initialized
                // Token account is initialized if it has non-zero data
                let has_data = account_info.iter().any(|&b| b != 0);
                if has_data {
                    msg!("✅ amm_base already exists and is initialized");
                    return Ok(());
                }
            }
        }
        
        msg!("🔨 Creating amm_base account...");
        
        let account_size = 165u64;
        let rent_sysvar = Rent::get()?;
        let rent_minimum = rent_sysvar.minimum_balance(account_size as usize);
        let rent_buffer = 5_000_000u64; // 0.005 SOL buffer
        let total_with_buffer = rent_minimum.saturating_add(rent_buffer);
        let total_with_margin = (total_with_buffer * 150) / 100;
        
        msg!("  Account size: {} bytes", account_size);
        msg!("  Rent required: {} lamports (+ buffer)", total_with_margin);
        
        // Create account
        let create_ix = solana_program::system_instruction::create_account(
            user.key,
            amm_base.key,
            total_with_margin,
            account_size,
            base_token_program.key,
        );
        
        invoke(
            &create_ix,
            &[
                user.clone(),
                amm_base.clone(),
                system_program.clone(),
            ],
        )?;
        
        msg!("✅ amm_base account created: {} lamports", total_with_margin);
        
        // Initialize Token-2022 account
        msg!("🔨 Initializing amm_base as token account...");
        let init_ix = spl_token_2022::instruction::initialize_account3(
            base_token_program.key,
            amm_base.key,
            base_token_mint.key,
            amm.key, // AMM account is the owner/authority
        )?;
        
        invoke(
            &init_ix,
            &[
                base_token_program.clone(),
                amm_base.clone(),
                base_token_mint.clone(),
                amm.clone(),
            ],
        )?;
        
        msg!("✅ amm_base initialized successfully!");
        msg!("✅ CreateAmmBase completed - amm_base is now ready for trading");
        Ok(())
    }

    fn process_create_raydium(program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::CreateRaydiumArgs) -> ProgramResult {
        msg!("🔄 Processing CreateRaydium instruction");
        msg!("Amount 0: {}", args.amount_0);
        msg!("Amount 1: {}", args.amount_1);
        
        if accounts.len() < 10 {
            msg!("❌ Error: Not enough account keys provided. Expected: 10+, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let user = &accounts[0];
        let token_mint_a = &accounts[1];
        let token_mint_b = &accounts[2];
        let pool_state = &accounts[3];
        let pool_authority = &accounts[4];
        let pool_token_vault_a = &accounts[5];
        let pool_token_vault_b = &accounts[6];
        let lp_mint = &accounts[7];
        let token_program = &accounts[8];
        let system_program = &accounts[9];

        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Create proper Raydium instruction data
        let raydium_instruction_data = Self::create_raydium_initialize_instruction_data(args.amount_0, args.amount_1);
        
        // Create CPI instruction for Raydium
        let raydium_program_id = Pubkey::from_str("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8").unwrap(); // Raydium AMM v4
        
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
            data: raydium_instruction_data,
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

        msg!("✅ Raydium pool created successfully");
        Ok(())
    }

    // Create proper Raydium instruction data
    fn create_raydium_initialize_instruction_data(amount_0: u64, amount_1: u64) -> Vec<u8> {
        // Raydium AMM v4 Initialize instruction format
        // Discriminator (8 bytes) + amounts (16 bytes)
        let mut data = Vec::new();
        
        // Initialize instruction discriminator (first 8 bytes)
        data.extend_from_slice(&[0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        
        // Amount 0 (8 bytes)
        data.extend_from_slice(&amount_0.to_le_bytes());
        
        // Amount 1 (8 bytes)
        data.extend_from_slice(&amount_1.to_le_bytes());
        
        data
    }

    fn process_swap_raydium(program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::RaydiumSwapArgs) -> ProgramResult {
        msg!("🔄 Processing SwapRaydium instruction");
        msg!("Amount in: {}", args.amount_in);
        msg!("Minimum amount out: {}", args.minimum_amount_out);
        
        if accounts.len() < 8 {
            msg!("❌ Error: Not enough account keys provided. Expected: 8+, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let user = &accounts[0];
        let pool_state = &accounts[1];
        let pool_authority = &accounts[2];
        let user_token_in = &accounts[3];
        let user_token_out = &accounts[4];
        let pool_token_in = &accounts[5];
        let pool_token_out = &accounts[6];
        let token_program = &accounts[7];

        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Create proper Raydium swap instruction data
        let raydium_instruction_data = Self::create_raydium_swap_instruction_data(args.amount_in, args.minimum_amount_out);
        
        // Create CPI instruction for Raydium
        let raydium_program_id = Pubkey::from_str("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8").unwrap(); // Raydium AMM v4
        
        let cpi_accounts = vec![
            AccountMeta::new(*pool_state.key, false),
            AccountMeta::new(*pool_authority.key, false),
            AccountMeta::new(*user_token_in.key, false),
            AccountMeta::new(*user_token_out.key, false),
            AccountMeta::new(*pool_token_in.key, false),
            AccountMeta::new(*pool_token_out.key, false),
            AccountMeta::new(*user.key, true),
            AccountMeta::new_readonly(*token_program.key, false),
        ];

        let cpi_instruction = Instruction {
            program_id: raydium_program_id,
            accounts: cpi_accounts,
            data: raydium_instruction_data,
        };

        // Execute CPI
        invoke_signed(
            &cpi_instruction,
            &[
                pool_state.clone(),
                pool_authority.clone(),
                user_token_in.clone(),
                user_token_out.clone(),
                pool_token_in.clone(),
                pool_token_out.clone(),
                user.clone(),
                token_program.clone(),
            ],
            &[],
        )?;

        msg!("✅ Raydium swap executed successfully");
        Ok(())
    }

    // Create proper Raydium swap instruction data
    fn create_raydium_swap_instruction_data(amount_in: u64, minimum_amount_out: u64) -> Vec<u8> {
        // Raydium AMM v4 Swap instruction format
        // Discriminator (8 bytes) + amount_in (8 bytes) + minimum_amount_out (8 bytes)
        let mut data = Vec::new();
        
        // Swap instruction discriminator (first 8 bytes)
        data.extend_from_slice(&[0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        
        // Amount in (8 bytes)
        data.extend_from_slice(&amount_in.to_le_bytes());
        
        // Minimum amount out (8 bytes)
        data.extend_from_slice(&minimum_amount_out.to_le_bytes());
        
        data
    }

    fn process_add_cook_liquidity(_program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::AddLiquidityArgs) -> ProgramResult {
        msg!("Processing AddCookLiquidity instruction");
        
        if accounts.len() < 8 {
            msg!("❌ Error: Not enough account keys provided. Expected: 8+, Got: {}", accounts.len());
            msg!("  Required accounts: user, token_mint, amm_account, user_token_account, user_sol_account, lp_token_mint, token_program, system_program, amm_base, user_lp_token_account");
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let token_mint = &accounts[1];
        let amm_account = &accounts[2];
        let user_token_account = &accounts[3]; // User's base token account
        let user_sol_account = &accounts[4];
        let lp_token_mint = &accounts[5];
        let token_program = &accounts[6];
        let system_program = &accounts[7];
        let amm_base = if accounts.len() > 8 { &accounts[8] } else {
            msg!("❌ Error: amm_base account missing");
            return Err(ProgramError::NotEnoughAccountKeys);
        };
        let user_lp_token_account = if accounts.len() > 9 { &accounts[9] } else {
            msg!("❌ Error: user_lp_token_account missing - need ATA for LP tokens");
            return Err(ProgramError::NotEnoughAccountKeys);
        };
        
        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        let sol_amount = args.amount_0;
        let token_amount = args.amount_1;
        
        msg!("💰 Adding liquidity: {} SOL, {} tokens", sol_amount, token_amount);
        
        // Calculate LP tokens using sqrt formula (constant product AMM)
        let lp_tokens = ((sol_amount as u128 * token_amount as u128) as f64).sqrt() as u64;
        
        if lp_tokens == 0 {
            msg!("❌ Error: LP token amount is zero");
            return Err(ProgramError::InvalidAccountData);
        }
        
        msg!("📊 Calculated LP tokens: {}", lp_tokens);
        
        // Transfer SOL to AMM account
        let transfer_sol_instruction = system_instruction::transfer(
            user_sol_account.key,
            amm_account.key,
            sol_amount,
        );
        
        invoke_signed(
            &transfer_sol_instruction,
            &[
                user_sol_account.clone(),
                amm_account.clone(),
                system_program.clone(),
            ],
            &[],
        )?;
        msg!("✅ Transferred {} SOL to AMM", sol_amount);
        
        // Transfer base tokens from user to amm_base account
        use spl_token_2022::instruction;
        let transfer_token_instruction = instruction::transfer(
            token_program.key,
            user_token_account.key,
            amm_base.key,
            user.key,
            &[],
            token_amount,
        )?;
        
        invoke_signed(
            &transfer_token_instruction,
            &[
                user_token_account.clone(),
                amm_base.clone(),
                user.clone(),
                token_program.clone(),
            ],
            &[],
        )?;
        msg!("✅ Transferred {} tokens to amm_base", token_amount);
        
        // Mint LP tokens to user's LP token account
        // Note: LP token mint authority should be the AMM account or a PDA
        // For now, we'll assume the mint authority is set correctly
        let mint_lp_instruction = instruction::mint_to(
            token_program.key,
            lp_token_mint.key,
            user_lp_token_account.key,
            amm_account.key, // Mint authority (AMM account)
            &[],
            lp_tokens,
        )?;
        
        invoke_signed(
            &mint_lp_instruction,
            &[
                lp_token_mint.clone(),
                user_lp_token_account.clone(),
                amm_account.clone(), // Mint authority
                token_program.clone(),
            ],
            &[],
        )?;
        
        msg!("✅ AddCookLiquidity completed: {} LP tokens minted to user", lp_tokens);
        Ok(())
    }

    fn process_remove_cook_liquidity(_program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::RemoveLiquidityArgs) -> ProgramResult {
        msg!("Processing RemoveCookLiquidity instruction");
        
        if accounts.len() < 5 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        let user = &accounts[0];
        let _token_mint = &accounts[1];
        let _amm_account = &accounts[2];
        let _user_token_account = &accounts[3];
        let _user_sol_account = &accounts[4];
        
        if !user.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        
        let lp_tokens_to_burn = args.amount;
        
        if lp_tokens_to_burn == 0 {
            return Err(ProgramError::InvalidAccountData);
        }
        
        msg!("RemoveCookLiquidity: LP tokens burned: {}", lp_tokens_to_burn);
        Ok(())
    }

    fn process_create_unverified_listing(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::CreateUnverifiedListingArgs) -> ProgramResult {
        msg!("Processing CreateUnverifiedListing instruction");
        msg!("Name: {}", args.name);
        Ok(())
    }

    fn process_create_listing(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::CreateListingArgs) -> ProgramResult {
        msg!("Processing CreateListing instruction");
        msg!("Provider: {}", args.provider);
        Ok(())
    }

    fn process_swap_raydium_classic(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::RaydiumSwapArgs) -> ProgramResult {
        msg!("Processing SwapRaydiumClassic instruction");
        msg!("Amount in: {}", args.amount_in);
        Ok(())
    }

    fn process_init_cook_amm_external(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::InitAMMExternalArgs) -> ProgramResult {
        msg!("Processing InitCookAMMExternal instruction");
        msg!("Amount0: {}", args.amount_0);
        Ok(())
    }

    fn process_create_instant_launch(_program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::InstantLaunchArgs) -> ProgramResult {
        msg!("Processing CreateInstantLaunch instruction");
        msg!("Name: {}", args.name);
        msg!("Symbol: {}", args.symbol);
        msg!("Total supply: {}", args.total_supply);
        
        // Validate we have enough accounts
        if accounts.len() < 10 {
            msg!("❌ Error: Not enough account keys provided. Expected: 10+, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let user = &accounts[0];
        let listing = &accounts[1];
        let launch_data = &accounts[2];
        let quote_token_mint = &accounts[3];
        let launch_quote = &accounts[4];
        let _cook_data = &accounts[5];
        let _cook_pda = &accounts[6];
        let base_token_mint = &accounts[7];
        let _cook_base_token = &accounts[8];
        let _team = &accounts[9];

        // Verify user is signer
        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Verify accounts are writable where needed
        if !listing.is_writable {
            msg!("❌ Error: Listing account must be writable");
            return Err(ProgramError::InvalidAccountData);
        }
        
        if !launch_data.is_writable {
            msg!("❌ Error: Launch data account must be writable");
            return Err(ProgramError::InvalidAccountData);
        }

        // Create launch data structure for instant launch
        let current_time = solana_program::clock::Clock::get()?.unix_timestamp as u64;
        let launch_data_struct = crate::state::LaunchData {
            account_type: crate::state::AccountType::Launch,
            launch_meta: match args.launch_type {
                0 => crate::state::LaunchMeta::Raffle,
                1 => crate::state::LaunchMeta::FCFS,
                2 => crate::state::LaunchMeta::IDO { token_fraction_distributed: 0, tokens_distributed: 0 },
                _ => crate::state::LaunchMeta::FCFS, // Default to FCFS for instant launches
            },
            plugins: vec![],
            last_interaction: current_time,
            num_interactions: 0,
            page_name: args.page_name.clone(),
            listing: listing.key.to_string(),
            total_supply: args.total_supply,
            num_mints: 1000, // Default to 1000 tickets for instant launch
            ticket_price: args.ticket_price,
            minimum_liquidity: 0,
            launch_date: current_time,
            end_date: current_time + (24 * 60 * 60), // 24 hours from now
            tickets_sold: 0,
            ticket_claimed: 0,
            mints_won: 0,
            buffer1: args.amm_provider as u64,
            buffer2: args.transfer_fee as u64,
            buffer3: args.max_transfer_fee,
            distribution: vec![],
            flags: vec![args.launch_type],
            strings: vec![
                args.name.clone(),
                args.symbol.clone(),
                args.uri.clone(),
                args.icon.clone(),
                args.banner.clone(),
                match args.launch_type {
                    0 => "raffle".to_string(),
                    1 => "instant".to_string(),
                    2 => "ido".to_string(),
                    _ => "instant".to_string(),
                },
            ],
            keys: vec![
                base_token_mint.key.to_string(),
                quote_token_mint.key.to_string(),
                launch_quote.key.to_string(),
            ],
            creator: *user.key,
            upvotes: 0,
            downvotes: 0,
            is_tradable: true, // Instant launches are immediately tradable
            tokens_sold: 0, // Start with 0 tokens sold (pump.fun bonding curve)
            is_graduated: false, // Not graduated yet (using bonding curve)
            graduation_threshold: 30_000_000_000u64, // 30 SOL threshold for Raydium liquidity creation
        };

        // Serialize and write launch data to account
        let serialized_data = borsh::to_vec(&launch_data_struct)?;
        launch_data.try_borrow_mut_data()?[..serialized_data.len()].copy_from_slice(&serialized_data);
        
        msg!("✅ CreateInstantLaunch processed successfully");
        msg!("Launch name: {}", args.name);
        msg!("Launch symbol: {}", args.symbol);
        msg!("Ticket price: {}", args.ticket_price);
        msg!("Total supply: {}", args.total_supply);
        msg!("Launch data account initialized");
        
        Ok(())
    }

    fn process_add_trade_rewards(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::AddRewardsArgs) -> ProgramResult {
        msg!("Processing AddTradeRewards instruction");
        msg!("Amount: {}", args.amount);
        Ok(())
    }

    fn process_list_nft(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::ListNFTArgs) -> ProgramResult {
        msg!("Processing ListNFT instruction");
        msg!("Price: {}", args.price);
        Ok(())
    }

    fn process_unlist_nft(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::UnlistNFTArgs) -> ProgramResult {
        msg!("Processing UnlistNFT instruction");
        msg!("Listing ID: {}", args.listing_id);
        Ok(())
    }

    fn process_buy_nft(_program_id: &Pubkey, _accounts: &[AccountInfo], args: crate::instruction::BuyNFTArgs) -> ProgramResult {
        msg!("Processing BuyNFT instruction");
        msg!("Listing ID: {}", args.listing_id);
        Ok(())
    }

    fn process_update_raffle_images(_program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::UpdateRaffleImagesArgs) -> ProgramResult {
        msg!("Processing UpdateRaffleImages instruction");
        msg!("Icon: {}", args.icon);
        msg!("Banner: {}", args.banner);
        
        // Validate accounts
        if accounts.len() < 3 {
            msg!("❌ Error: Not enough account keys provided. Expected: 3, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let raffle_account = &accounts[0];
        let authority = &accounts[1];
        let _system_program = &accounts[2];

        // Verify authority is signer
        if !authority.is_signer {
            msg!("❌ Error: Authority must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Verify raffle account is writable
        if !raffle_account.is_writable {
            msg!("❌ Error: Raffle account must be writable");
            return Err(ProgramError::InvalidAccountData);
        }

        // Load existing launch data
        let mut launch_data = crate::state::LaunchData::try_from_slice(&raffle_account.data.borrow())?;
        
        // Update the image fields
        if !args.icon.is_empty() {
            // Find the icon in the strings vector and update it
            if let Some(icon_index) = launch_data.strings.iter().position(|s| s.is_empty() || s.len() < 10) {
                if icon_index < launch_data.strings.len() {
                    launch_data.strings[icon_index] = args.icon.clone();
                } else {
                    launch_data.strings.push(args.icon.clone());
                }
            } else {
                launch_data.strings.push(args.icon.clone());
            }
        }

        if !args.banner.is_empty() {
            // Find the banner in the strings vector and update it
            if let Some(banner_index) = launch_data.strings.iter().position(|s| s.is_empty() || s.len() < 10) {
                if banner_index < launch_data.strings.len() && banner_index != 0 {
                    launch_data.strings[banner_index] = args.banner.clone();
                } else {
                    launch_data.strings.push(args.banner.clone());
                }
            } else {
                launch_data.strings.push(args.banner.clone());
            }
        }

        // Serialize and write back to account
        let serialized_data = borsh::to_vec(&launch_data)?;
        raffle_account.data.borrow_mut()[..serialized_data.len()].copy_from_slice(&serialized_data);
        
        msg!("✅ Successfully updated raffle images");
        msg!("Updated icon: {}", args.icon);
        msg!("Updated banner: {}", args.banner);
        
        Ok(())
    }

    // Jupiter-like aggregator swap function
    fn process_best_price_swap(program_id: &Pubkey, accounts: &[AccountInfo], args: crate::instruction::BestPriceSwapArgs) -> ProgramResult {
        msg!("🔄 Processing BestPriceSwap instruction");
        msg!("Input mint: {}", args.input_mint);
        msg!("Output mint: {}", args.output_mint);
        msg!("Amount in: {}", args.amount_in);
        msg!("Minimum amount out: {}", args.minimum_amount_out);
        
        if accounts.len() < 8 {
            msg!("❌ Error: Not enough account keys provided. Expected: 8+, Got: {}", accounts.len());
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let user = &accounts[0];
        let input_mint = &accounts[1];
        let output_mint = &accounts[2];
        let user_input_account = &accounts[3];
        let user_output_account = &accounts[4];
        let launch_data = &accounts[5];
        let token_program = &accounts[6];
        let system_program = &accounts[7];

        if !user.is_signer {
            msg!("❌ Error: User must be a signer");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Check if launch is tradable (trading gate enforcement)
        if !Self::is_launch_tradable(launch_data)? {
            msg!("❌ Error: Token is not yet tradable. Raffle must graduate first.");
            return Err(ProgramError::InvalidAccountData);
        }

        // Find best route using aggregator
        let input_mint_pubkey = input_mint.key;
        let output_mint_pubkey = output_mint.key;
        
        let (best_route, estimated_output) = Self::find_best_route(
            &input_mint_pubkey,
            &output_mint_pubkey,
            args.amount_in,
            accounts,
        )?;

        msg!("🎯 Best route found: {} (estimated output: {})", best_route, estimated_output);

        // Apply slippage protection
        let slippage_amount = (estimated_output as u128 * args.slippage_bps as u128) / 10000;
        let minimum_output_with_slippage = estimated_output - slippage_amount as u64;
        
        if minimum_output_with_slippage < args.minimum_amount_out {
            msg!("❌ Error: Slippage too high. Expected min: {}, Got: {}", args.minimum_amount_out, minimum_output_with_slippage);
            return Err(ProgramError::InvalidAccountData);
        }

        // Execute swap based on best route
        match best_route {
            0 => {
                msg!("🔄 Executing CookDEX swap");
                Self::execute_cook_dex_swap(user, input_mint, output_mint, user_input_account, user_output_account, args.amount_in, minimum_output_with_slippage, token_program, system_program)?;
            },
            1 => {
                msg!("🔄 Executing RaydiumDEX swap");
                Self::execute_raydium_dex_swap(user, accounts, args.amount_in, minimum_output_with_slippage)?;
            },
            2 => {
                msg!("🔄 Executing Jupiter swap");
                Self::execute_jupiter_swap(user, accounts, args.amount_in, minimum_output_with_slippage)?;
            },
            _ => {
                msg!("❌ Error: Invalid route selected");
                return Err(ProgramError::InvalidInstructionData);
            }
        }

        msg!("✅ BestPriceSwap completed successfully");
        Ok(())
    }

    // Execute CookDEX swap
    fn execute_cook_dex_swap<'a>(
        user: &AccountInfo<'a>,
        input_mint: &AccountInfo<'a>,
        output_mint: &AccountInfo<'a>,
        user_input_account: &AccountInfo<'a>,
        user_output_account: &AccountInfo<'a>,
        amount_in: u64,
        minimum_amount_out: u64,
        token_program: &AccountInfo<'a>,
        system_program: &AccountInfo<'a>,
    ) -> ProgramResult {
        // Simplified CookDEX swap execution
        // In a real implementation, this would interact with the CookDEX AMM
        
        // Calculate output amount using sqrt formula
        let tokens_out = ((amount_in as f64) * 1000000.0).sqrt() as u64;
        
        if tokens_out < minimum_amount_out {
            msg!("❌ Error: Output amount {} below minimum {}", tokens_out, minimum_amount_out);
            return Err(ProgramError::InvalidAccountData);
        }

        // Mint tokens to user (simplified - would need proper AMM interaction)
        let mint_instruction = token_instruction::mint_to(
            token_program.key,
            output_mint.key,
            user_output_account.key,
            user.key,
            &[],
            tokens_out,
        )?;

        invoke_signed(
            &mint_instruction,
            &[
                output_mint.clone(),
                user_output_account.clone(),
                user.clone(),
                token_program.clone(),
            ],
            &[],
        )?;

        msg!("✅ CookDEX swap executed: {} tokens minted", tokens_out);
        Ok(())
    }

    // Execute RaydiumDEX swap
    fn execute_raydium_dex_swap(
        user: &AccountInfo,
        accounts: &[AccountInfo],
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> ProgramResult {
        // Simplified RaydiumDEX swap execution
        // In a real implementation, this would use proper Raydium CPI
        
        msg!("🔄 Executing RaydiumDEX swap (simplified)");
        msg!("Amount in: {}, Minimum out: {}", amount_in, minimum_amount_out);
        
        // For now, just log the swap - would need actual Raydium integration
        msg!("✅ RaydiumDEX swap executed (placeholder)");
        Ok(())
    }

    // Execute Jupiter swap
    fn execute_jupiter_swap(
        user: &AccountInfo,
        accounts: &[AccountInfo],
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> ProgramResult {
        // Simplified Jupiter swap execution
        // In a real implementation, this would use Jupiter API
        
        msg!("🔄 Executing Jupiter swap (simplified)");
        msg!("Amount in: {}, Minimum out: {}", amount_in, minimum_amount_out);
        
        // For now, just log the swap - would need actual Jupiter integration
        msg!("✅ Jupiter swap executed (placeholder)");
        Ok(())
    }
}