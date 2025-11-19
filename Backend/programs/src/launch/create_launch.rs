use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program::invoke_signed, program_error::ProgramError, program_pack::Pack,
    pubkey::Pubkey, sysvar::Sysvar,
};

use crate::{
    accounts,
    instruction::{accounts::CreateLaunchAccounts, CreateArgs},
    launch::{Distribution, LaunchData, LaunchFlags, LaunchKeys, LaunchMeta, LaunchPlugin, Listing, Raffle, WhiteListToken, FCFS, IDO},
    state,
    utils::{self, calculate_rent, create_2022_token},
    events::emit_launch_created_event,
};
pub fn create_launch<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: CreateArgs) -> ProgramResult {
    msg!("🚀 Starting create_launch instruction");
    msg!("📊 Args: name={}, symbol={}, launch_type={}", args.name, args.symbol, args.launch_type);
    msg!("💰 Ticket price: {} lamports, {} SOL", args.ticket_price, utils::to_sol(args.ticket_price));
    
    msg!("📋 Creating account context");
    let ctx: crate::instruction::accounts::Context<CreateLaunchAccounts> = CreateLaunchAccounts::context(accounts)?;
    msg!("✅ Account context created successfully");

    msg!("🔍 Verifying accounts");

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // ============================================
    // STEP 1: Derive and validate token mint PDA
    // ============================================
    // Derive token mint PDA from page_name with "cook" prefix
    // Using "cook" in the seed ensures the PDA address contains "cook"
    msg!("🔍 STEP 1: Deriving token mint PDA from page_name with 'cook' prefix");
    let (expected_token_mint, token_mint_bump) = Pubkey::find_program_address(
        &[b"cook", b"TokenMint", args.page_name.as_bytes()],
        program_id,
    );
    
    // Validate the provided base_token_mint matches the derived PDA
    if *ctx.accounts.base_token_mint.key != expected_token_mint {
        msg!("❌ Error: Token mint must be a PDA derived from page_name");
        msg!("  Expected PDA: {}", expected_token_mint);
        msg!("  Received: {}", ctx.accounts.base_token_mint.key);
        msg!("  Seeds: [b\"cook\", b\"TokenMint\", page_name: \"{}\"]", args.page_name);
        return Err(ProgramError::InvalidAccountData);
    }
    msg!("✅ Token mint PDA validated: {} (bump: {})", ctx.accounts.base_token_mint.key, token_mint_bump);
    
    // Clone page_name early since it will be moved into launch_data later
    let page_name_clone = args.page_name.clone();
    
    // Note: create_2022_token will handle PDA account creation with correct size
    // No need to create the account here - let create_2022_token do it

    msg!("🔍 Validating listing PDA");
    let listing_bump_seed = accounts::check_program_data_account(
        ctx.accounts.listing,
        program_id,
        vec![&ctx.accounts.base_token_mint.key.to_bytes(), b"Listing"],
    )?;
    msg!("✅ Listing PDA validated");

    msg!("🔍 Validating launch_data PDA");
    let launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.launch_data, program_id, vec![args.page_name.as_bytes(), b"Launch"])?;
    msg!("✅ Launch_data PDA validated");

    accounts::check_wrapped_sol_key(ctx.accounts.quote_token_mint)?;

    msg!("🔍 Validating cook_data PDA");
    let _pda_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_data, program_id, vec![&accounts::DATA_SEED.to_le_bytes()])?;
    msg!("✅ Cook_data PDA validated");

    msg!("🔍 Validating cook_pda PDA");
    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()])?;
    msg!("✅ Cook_pda PDA validated");

    accounts::check_token_account(
        ctx.accounts.cook_pda,
        ctx.accounts.base_token_mint,
        ctx.accounts.cook_base_token,
        ctx.accounts.base_token_program,
    )?;

    accounts::check_system_program_key(ctx.accounts.system_program)?;
    let _quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;
    let base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;
    accounts::check_associated_token_program_key(ctx.accounts.associated_token)?;

    // Handle any other checks

    // if this page name has been used, cancel
    if **ctx.accounts.launch_data.try_borrow_lamports()? > 0 {
        msg!("This page name already exists");
        return Ok(());
    }

    // check the launch/end dates are sane
    let clock = Clock::get()?;
    let last_interaction = clock.unix_timestamp;

    if args.launch_date > 0 && last_interaction > (args.launch_date / 1000) as i64 {
        msg!("Cannot create launch that starts in the past");
        return Err(ProgramError::InvalidAccountData);
    }

    if args.close_date <= args.launch_date {
        msg!("Cannot create launch that ends before it starts");
        return Err(ProgramError::InvalidAccountData);
    }

    if args.decimals < 1 || args.decimals > 9 {
        msg!("invalid decimal places");
        return Err(ProgramError::InvalidAccountData);
    }

    // num_mints == 0 means unlimited tickets (up to total_supply)
    // This is validated below to ensure it doesn't exceed total_supply

    // Validate string lengths to prevent account size issues
    if args.name.len() > 50 {
        msg!("Name too long (max 50 characters)");
        return Err(ProgramError::InvalidAccountData);
    }

    if args.symbol.len() > 10 {
        msg!("Symbol too long (max 10 characters)");
        return Err(ProgramError::InvalidAccountData);
    }

    if args.page_name.len() > 32 {
        msg!("Page name too long (max 32 characters)");
        return Err(ProgramError::InvalidAccountData);
    }

    // Validate total supply is reasonable
    if args.total_supply > 1_000_000_000_000_000 {
        msg!("Total supply too large (max 1 quadrillion)");
        return Err(ProgramError::InvalidAccountData);
    }

    // Determine actual num_mints: 0 means unlimited (up to total_supply)
    let actual_num_mints = if args.num_mints == 0 {
        // Unlimited: cap at total_supply (but ensure it fits in u32)
        if args.total_supply > u32::MAX as u64 {
            msg!("total_supply too large for unlimited tickets (max: {})", u32::MAX);
            return Err(ProgramError::InvalidAccountData);
        }
        args.total_supply as u32
    } else {
        // Validate num_mints doesn't exceed total_supply
        if u64::from(args.num_mints) > args.total_supply {
            msg!("num_mints cannot exceed total_supply");
            return Err(ProgramError::InvalidAccountData);
        }
        args.num_mints
    };

    msg!("🔍 Validating ticket price: {} lamports = {} SOL", args.ticket_price, utils::to_sol(args.ticket_price));
    if utils::to_sol(args.ticket_price) < 0.0001 {
        msg!("❌ ticket price must be greater than 0.0001 SOL");
        return Err(ProgramError::InvalidAccountData);
    }
    msg!("✅ Ticket price validation passed");

    msg!("🔍 Validating total supply: {}", args.total_supply);
    if args.total_supply < 10 {
        msg!("❌ Total supply must be greater than 10");
        return Err(ProgramError::InvalidAccountData);
    }
    msg!("✅ Total supply validation passed");

    // create the wrapped sol account

    let token_lamports = calculate_rent(spl_token::state::Account::LEN as u64);

    let mint_seed: String = ctx.accounts.base_token_mint.key.to_string()[..32].to_string();

    msg!("use seed {}", mint_seed);

    let base_ix = solana_program::system_instruction::create_account_with_seed(
        ctx.accounts.user.key,
        ctx.accounts.launch_quote.key,
        ctx.accounts.cook_pda.key,
        &mint_seed,
        token_lamports,
        spl_token::state::Account::LEN as u64,
        ctx.accounts.quote_token_program.key,
    );

    invoke_signed(
        &base_ix,
        &[
            ctx.accounts.user.clone(),
            ctx.accounts.launch_quote.clone(),
            ctx.accounts.quote_token_program.clone(),
            ctx.accounts.cook_pda.clone(),
        ],
        &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]],
    )?;

    let init_base_idx = spl_token_2022::instruction::initialize_account3(
        ctx.accounts.quote_token_program.key,
        ctx.accounts.launch_quote.key,
        ctx.accounts.quote_token_mint.key,
        ctx.accounts.cook_pda.key,
    )
    .map_err(|e| {
        msg!("Failed to create initialize_account3 instruction: {:?}", e);
        ProgramError::InvalidInstructionData
    })?;

    invoke_signed(
        &init_base_idx,
        &[
            ctx.accounts.quote_token_program.clone(),
            ctx.accounts.launch_quote.clone(),
            ctx.accounts.quote_token_mint.clone(),
            ctx.accounts.cook_pda.clone(),
        ],
        &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]],
    )?;

    let mut program_data = state::ProgramData::try_from_slice(&ctx.accounts.cook_data.data.borrow()[..])?;

    program_data.num_launches += 1;

    program_data.serialize(&mut &mut ctx.accounts.cook_data.data.borrow_mut()[..])?;

    msg!("create game account");

    msg!("dates {} {} {}", args.launch_date, args.close_date, last_interaction);

    let meta = if args.launch_type == 0 {
        LaunchMeta::Raffle(Raffle {})
    } else if args.launch_type == 1 {
        LaunchMeta::FCFS(FCFS {})
    } else {
        LaunchMeta::IDO(IDO {
            token_fraction_distributed: 0 as f64,
            tokens_distributed: 0,
        })
    };

    let mut launch_plugins: Vec<LaunchPlugin> = Vec::new();
    // check for whitelist plugin
    if args.whitelist_tokens > 0 {
        let whitelist_plugin = LaunchPlugin::WhiteListToken(WhiteListToken {
            key: *ctx.accounts.whitelist.key,
            quantity: args.whitelist_tokens,
            phase_end: args.whitelist_end,
        });

        launch_plugins.push(whitelist_plugin);
    }

    let mut listing = Listing {
        account_type: state::AccountType::Listing,
        id: program_data.num_launches,
        mint: *ctx.accounts.base_token_mint.key,
        name: args.name,
        symbol: args.symbol,
        decimals: args.decimals,
        icon_url: args.icon,
        meta_url: args.uri,
        banner_url: args.banner,
        description: "".to_string(),
        positive_votes: 0,
        negative_votes: 0,
        socials: Vec::with_capacity(state::Socials::LENGTH as usize),
    };

    let mut launch_data = LaunchData {
        account_type: state::AccountType::Launch,
        launch_meta: meta,
        plugins: launch_plugins,
        last_interaction: last_interaction,
        num_interactions: 1,
        listing: *ctx.accounts.listing.key,
        page_name: args.page_name,
        total_supply: args.total_supply,
        num_mints: actual_num_mints, // Use calculated value (0 input becomes total_supply)
        ticket_price: args.ticket_price,
        minimum_liquidity: args.ticket_price * (actual_num_mints as u64),
        launch_date: if args.launch_date > 0 {
            args.launch_date
        } else {
            (last_interaction * 1000) as u64
        },
        end_date: args.close_date,
        tickets_sold: 0,
        ticket_claimed: 0,
        mints_won: 0,

        buffer1: 0,
        buffer2: 0,
        buffer3: 0,
        distribution: Vec::with_capacity(Distribution::LENGTH as usize),
        flags: Vec::with_capacity(LaunchFlags::LENGTH as usize),
        strings: Vec::new(),
        keys: Vec::with_capacity(LaunchKeys::LENGTH as usize),
        
        // Instant launch fields (pump.fun-style bonding curve)
        is_tradable: false, // Raffle launches start non-tradable until graduation
        tokens_sold: 0, // Start with 0 tokens sold
        is_graduated: false, // Not graduated yet
        graduation_threshold: 30_000_000_000u64, // 30 SOL threshold for Raydium liquidity creation
    };

    listing.socials = vec!["".to_string(); state::Socials::LENGTH as usize];

    launch_data.distribution = vec![0; Distribution::LENGTH as usize];

    msg!("🔧 Setting up launch keys and flags");
    launch_data.keys = vec![Pubkey::default(); LaunchKeys::LENGTH as usize];
    msg!("✅ Keys vector created with length: {}", launch_data.keys.len());
    
    launch_data.keys[LaunchKeys::Seller as usize] = *ctx.accounts.user.key;
    msg!("✅ Seller key set");
    
    launch_data.keys[LaunchKeys::TeamWallet as usize] = *ctx.accounts.team.key;
    msg!("✅ Team wallet key set");
    
    launch_data.keys[LaunchKeys::WSOLAddress as usize] = *ctx.accounts.launch_quote.key;
    msg!("✅ WSOL address key set");

    launch_data.flags = vec![0; LaunchFlags::LENGTH as usize];
    msg!("✅ Flags vector created with length: {}", launch_data.flags.len());

    launch_data.flags[LaunchFlags::Extensions as usize] = args.extensions;
    msg!("✅ Extensions flag set");
    
    launch_data.flags[LaunchFlags::AMMProvider as usize] = args.amm_provider;
    msg!("✅ AMM provider flag set");

    let listing_len = to_vec(&listing)
        .map_err(|e| {
            msg!("Failed to serialize listing: {:?}", e);
            ProgramError::InvalidAccountData
        })?
        .len();

    // create the listing account
    utils::create_program_account(
        ctx.accounts.user,
        ctx.accounts.listing,
        program_id,
        listing_bump_seed,
        listing_len,
        vec![&ctx.accounts.base_token_mint.key.to_bytes(), b"Listing"],
    )?;

    listing.serialize(&mut &mut ctx.accounts.listing.data.borrow_mut()[..])?;

    let launch_len = to_vec(&launch_data)
        .map_err(|e| {
            msg!("Failed to serialize launch_data: {:?}", e);
            ProgramError::InvalidAccountData
        })?
        .len();

    // create the account if required
    utils::create_program_account(
        ctx.accounts.user,
        ctx.accounts.launch_data,
        program_id,
        launch_bump_seed,
        launch_len,
        vec![launch_data.page_name.as_bytes(), b"Launch"],
    )?;

    launch_data.serialize(&mut &mut ctx.accounts.launch_data.data.borrow_mut()[..])?;

    let total_token_amount = launch_data.total_supply * u64::pow(10, listing.decimals as u32);

    // Convert ipfs:// URI to HTTP gateway URL for on-chain storage
    // Wallets and explorers like Solscan need HTTP URLs, not ipfs:// protocol URLs
    let metadata_uri = if listing.meta_url.starts_with("ipfs://") {
        // Extract CID from ipfs://CID
        let cid = listing.meta_url.trim_start_matches("ipfs://");
        // Use Pinata gateway (most reliable for wallets/explorers)
        format!("https://gateway.pinata.cloud/ipfs/{}", cid)
    } else if listing.meta_url.starts_with("http://") || listing.meta_url.starts_with("https://") {
        // Already an HTTP URL, use as-is
        listing.meta_url.to_string()
    } else {
        // Assume it's a CID without prefix, add gateway
        format!("https://gateway.pinata.cloud/ipfs/{}", listing.meta_url)
    };
    
    msg!("📝 Metadata URI conversion:");
    msg!("  Original: {}", listing.meta_url);
    msg!("  Stored on-chain: {}", metadata_uri);

    let token_config = state::TokenDetails {
        name: listing.name.to_string(),
        symbol: listing.symbol.to_string(),
        uri: metadata_uri,
        pda: accounts::SOL_SEED,
        decimals: listing.decimals,
        total_supply: total_token_amount,
    };

    if base_2022 {
        // mint the token
        // Prepare PDA seeds for mint account creation
        // Seeds: [b"cook", b"TokenMint", page_name, bump]
        // Use cloned page_name since args.page_name was moved into launch_data
        let mint_seeds: &[&[u8]] = &[
            b"cook",
            b"TokenMint",
            page_name_clone.as_bytes(),
            &[token_mint_bump],
        ];
        
        create_2022_token(
            ctx.accounts.user,
            ctx.accounts.cook_pda,
            ctx.accounts.base_token_program,
            pda_sol_bump_seed,
            ctx.accounts.system_program,
            ctx.accounts.associated_token, // ✅ Pass associated_token_program for Token-2022 ATA creation
            ctx.accounts.base_token_mint,
            ctx.accounts.cook_base_token,
            ctx.accounts.cook_pda,
            token_config,
            args.transfer_fee,
            args.max_transfer_fee,
            Some(ctx.accounts.delegate),
            Some(ctx.accounts.hook),
            Some(mint_seeds), // ✅ Pass PDA seeds for account creation
            None, // ✅ None = cook_base_token is an ATA, not a PDA
        )
        .map_err(|_e| {
            msg!("Failed to create 2022 token");
            ProgramError::InvalidAccountData
        })?;
    } else {
        // Always use Token-2022 for new launches to ensure metadata is always included
        msg!("⚠️ Standard SPL Token not supported for new launches - only Token-2022 is supported");
        msg!("   Token-2022 ensures metadata is always included with the token");
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Emit on-chain event for launch creation
    emit_launch_created_event(
        ctx.accounts.base_token_mint.key,
        ctx.accounts.user.key,
        args.launch_type,
        args.total_supply,
        args.ticket_price,
    );
    
    msg!("✅ Launch created successfully!");
    Ok(())
}
