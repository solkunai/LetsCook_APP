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
};
pub fn create_launch<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: CreateArgs) -> ProgramResult {
    msg!("in create game, getting accounts");

    let ctx: crate::instruction::accounts::Context<CreateLaunchAccounts> = CreateLaunchAccounts::context(accounts)?;

    msg!("verify accounts");

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let listing_bump_seed = accounts::check_program_data_account(
        ctx.accounts.listing,
        program_id,
        vec![&ctx.accounts.base_token_mint.key.to_bytes(), b"Listing"],
    )
    .unwrap();

    let launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.launch_data, program_id, vec![args.page_name.as_bytes(), b"Launch"]).unwrap();

    accounts::check_wrapped_sol_key(ctx.accounts.quote_token_mint)?;

    let _pda_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_data, program_id, vec![&accounts::DATA_SEED.to_le_bytes()]).unwrap();

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

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

    if args.num_mints == 0 {
        msg!("num mints must be > 0");
        return Err(ProgramError::InvalidAccountData);
    }

    if utils::to_sol(args.ticket_price) < 0.0001 {
        msg!("ticket price must be greater than 0.0001 SOL");
        return Err(ProgramError::InvalidAccountData);
    }

    if args.total_supply < 10 {
        msg!("Total supply must be greater than 10");
        return Err(ProgramError::InvalidAccountData);
    }

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
    .unwrap();

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
        num_mints: args.num_mints,
        ticket_price: args.ticket_price,
        minimum_liquidity: args.ticket_price * (args.num_mints as u64),
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
    };

    listing.socials = vec!["".to_string(); state::Socials::LENGTH as usize];

    launch_data.distribution = vec![0; Distribution::LENGTH as usize];

    launch_data.keys = vec![Pubkey::default(); LaunchKeys::LENGTH as usize];
    launch_data.keys[LaunchKeys::Seller as usize] = *ctx.accounts.user.key;
    launch_data.keys[LaunchKeys::TeamWallet as usize] = *ctx.accounts.team.key;
    launch_data.keys[LaunchKeys::WSOLAddress as usize] = *ctx.accounts.launch_quote.key;

    launch_data.flags = vec![0; LaunchFlags::LENGTH as usize];

    launch_data.flags[LaunchFlags::Extensions as usize] = args.extensions;
    launch_data.flags[LaunchFlags::AMMProvider as usize] = args.amm_provider;

    let listing_len = to_vec(&listing).unwrap().len();

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

    let launch_len = to_vec(&launch_data).unwrap().len();

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

    let token_config = state::TokenDetails {
        name: listing.name.to_string(),
        symbol: listing.symbol.to_string(),
        uri: listing.meta_url.to_string(),
        pda: accounts::SOL_SEED,
        decimals: listing.decimals,
        total_supply: total_token_amount,
    };

    if base_2022 {
        // mint the token
        create_2022_token(
            ctx.accounts.user,
            ctx.accounts.cook_pda,
            ctx.accounts.base_token_program,
            pda_sol_bump_seed,
            ctx.accounts.base_token_mint,
            ctx.accounts.cook_base_token,
            ctx.accounts.cook_pda,
            token_config,
            args.transfer_fee,
            args.max_transfer_fee,
            ctx.accounts.delegate,
            ctx.accounts.hook,
        )
        .unwrap();
    } else {
        msg!("Only T22 supported");
        return Err(ProgramError::InvalidAccountData);
    }
    Ok(())
}
