use borsh::{to_vec, BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};
use spl_token_2022::extension::StateWithExtensions;

use crate::amm::create_amm;
use crate::amm::create_lp_mint;
use crate::amm::get_amm_seeds;
use crate::amm::AMMPlugin;
use crate::amm::TimeSeriesData;
use crate::amm::AMM;
use crate::amm::OHLCV;
use crate::launch::Listing;
use crate::state;
use crate::utils;
use crate::{accounts, instruction::accounts::InitCookAMMAccounts, launch};

pub fn init_amm<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    msg!("in init_amm, getting accounts");

    let ctx: crate::instruction::accounts::Context<InitCookAMMAccounts> = InitCookAMMAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let listing = Listing::try_from_slice(&ctx.accounts.listing.data.borrow()[..])?;
    let _listing_bump_seed =
        accounts::check_program_data_account(ctx.accounts.listing, program_id, vec![&listing.mint.to_bytes(), b"Listing"]).unwrap();

    let mut launch_data = launch::LaunchData::try_from_slice(&ctx.accounts.launch_data.data.borrow()[..])?;

    let _user_data_bump = accounts::check_program_data_account(
        &ctx.accounts.user_data,
        program_id,
        vec![&launch_data.keys[launch::LaunchKeys::Seller as usize].to_bytes(), b"User"],
    )
    .unwrap();

    let mut user_data = state::UserData::try_from_slice(&ctx.accounts.user_data.data.borrow()[..])?;

    let _launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.launch_data, program_id, vec![launch_data.page_name.as_bytes(), b"Launch"]).unwrap();

    if *ctx.accounts.team.key != launch_data.keys[launch::LaunchKeys::TeamWallet as usize] {
        msg!("Team wallet address mismatch");
        return Err(ProgramError::InvalidAccountData);
    }

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
    get_amm_seeds(*ctx.accounts.base_token_mint.key, *ctx.accounts.quote_token_mint.key, &mut amm_seed_keys);

    let amm_bump_seed = accounts::check_program_data_account(
        ctx.accounts.amm,
        program_id,
        vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), b"CookAMM"],
    )
    .unwrap();

    accounts::check_token_account(
        ctx.accounts.amm,
        ctx.accounts.base_token_mint,
        ctx.accounts.amm_base,
        ctx.accounts.base_token_program,
    )?;

    accounts::check_token_account(
        ctx.accounts.amm,
        ctx.accounts.quote_token_mint,
        ctx.accounts.amm_quote,
        ctx.accounts.quote_token_program,
    )?;

    accounts::check_token_account(
        ctx.accounts.cook_pda,
        ctx.accounts.base_token_mint,
        ctx.accounts.cook_base_token,
        ctx.accounts.base_token_program,
    )?;

    let trade_to_earn_bump = accounts::check_program_data_account(
        ctx.accounts.trade_to_earn,
        program_id,
        vec![&ctx.accounts.amm.key.to_bytes(), b"TradeToEarn"],
    )
    .unwrap();

    create_amm(
        ctx.accounts.user,
        ctx.accounts.amm,
        ctx.accounts.amm,
        ctx.accounts.amm_quote,
        ctx.accounts.quote_token_mint,
        ctx.accounts.amm_base,
        ctx.accounts.base_token_mint,
        ctx.accounts.lp_token_mint,
        ctx.accounts.quote_token_program,
        ctx.accounts.base_token_program,
        program_id,
        amm_bump_seed,
        25,
        0,
        0,
        ctx.accounts.trade_to_earn,
        trade_to_earn_bump,
        true,
    )?;

    if *ctx.accounts.cook_quote_token.key != launch_data.keys[launch::LaunchKeys::WSOLAddress as usize] {
        msg!("pda WSOL address mismatch");
        return Err(ProgramError::InvalidAccountData);
    }

    if *ctx.accounts.base_token_mint.key != listing.mint {
        msg!("Token mint address mismatch");
        return Err(ProgramError::InvalidAccountData);
    }

    let lp_bump_seed =
        accounts::check_program_data_account(ctx.accounts.lp_token_mint, program_id, vec![&ctx.accounts.amm.key.to_bytes(), b"LP"]).unwrap();

    accounts::check_wrapped_sol_key(ctx.accounts.quote_token_mint)?;

    let num_price_accounts: u32 = 0;

    let price_data_bump_seed = accounts::check_program_data_account(
        ctx.accounts.price_data,
        program_id,
        vec![&ctx.accounts.amm.key.to_bytes(), &num_price_accounts.to_le_bytes(), b"TimeSeries"],
    )
    .unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;
    let quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;
    let base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;
    accounts::check_associated_token_program_key(ctx.accounts.associated_token)?;

    msg!("accounts checked");

    if launch_data.flags[launch::LaunchFlags::LPState as usize] == 2 {
        msg!("AMM already had tokens transferred");
        return Ok(());
    }

    if launch_data.flags[launch::LaunchFlags::LaunchFailed as usize] == 1 {
        msg!("Launch has failed, cannot transfer tokens for AMM");
        return Err(ProgramError::InvalidAccountData);
    }

    msg!("other checks passed");

    // get the mint data for the base and quote mints
    let base_mint_data = ctx.accounts.base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;
    let quote_mint_data = ctx.accounts.quote_token_mint.data.borrow();
    let quote_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&quote_mint_data)?;

    let quote_amount: u64 = launch_data.ticket_price * launch_data.num_mints as u64;
    let total_token_amount = launch_data.total_supply * u64::pow(10, base_mint.base.decimals as u32);

    let base_amount = ((total_token_amount as f64) * ((launch_data.distribution[launch::Distribution::LP as usize] as f64) / (100 as f64))) as u64;

    msg!("{} {}", quote_amount, base_amount);

    msg!("transfer base token to AMM");
    utils::transfer_tokens(
        base_2022,
        base_amount,
        ctx.accounts.cook_base_token,
        ctx.accounts.base_token_mint,
        ctx.accounts.amm_base,
        ctx.accounts.cook_pda,
        ctx.accounts.base_token_program,
        pda_sol_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        base_mint.base.decimals,
        &transfer_hook_accounts,
    )?;

    msg!("transfer quote token to AMM");

    utils::transfer_tokens(
        quote_2022,
        quote_amount,
        ctx.accounts.cook_quote_token,
        ctx.accounts.quote_token_mint,
        ctx.accounts.amm_quote,
        ctx.accounts.cook_pda,
        ctx.accounts.quote_token_program,
        pda_sol_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        quote_mint.base.decimals,
        &transfer_hook_accounts,
    )?;

    launch_data.flags[launch::LaunchFlags::LPState as usize] = 2;
    user_data.total_points += 2000;

    // create the ATA for the Team
    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.team,
        ctx.accounts.base_token_mint,
        ctx.accounts.team_token,
        ctx.accounts.base_token_program,
    )?;

    let user_token_frac: f64 = launch::get_user_dist(launch_data.distribution.clone());

    let total_token_amount: f64 = (launch_data.total_supply * u64::pow(10, base_mint.base.decimals as u32)) as f64;

    let user_token_amount: u64 = (user_token_frac * total_token_amount) as u64;
    utils::transfer_tokens(
        base_2022,
        user_token_amount,
        ctx.accounts.cook_base_token,
        ctx.accounts.base_token_mint,
        ctx.accounts.team_token,
        ctx.accounts.cook_pda,
        ctx.accounts.base_token_program,
        pda_sol_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        base_mint.base.decimals,
        &transfer_hook_accounts,
    )?;

    // Update the last interaction for the launch
    let clock = Clock::get()?;
    launch_data.last_interaction = clock.unix_timestamp;

    // Now that we have transferred the tokens, set the initial amounts

    let initial_quote_amount = utils::get_token_balance(ctx.accounts.amm_quote);
    let initial_base_amount = utils::get_token_balance(ctx.accounts.amm_base);

    let base_float_amount = (initial_base_amount as f64) / 10_f64.powi(base_mint.base.decimals as i32);
    let quote_float_amount = (initial_quote_amount as f64) / 10_f64.powi(quote_mint.base.decimals as i32);

    let price = (quote_float_amount / base_float_amount) as f32;

    let mut amm_data = AMM::try_from_slice(&ctx.accounts.amm.data.borrow()[..])?;
    amm_data.last_price = price;
    amm_data.lp_amount = f64::sqrt((initial_base_amount * initial_quote_amount) as f64) as u64;
    amm_data.amm_base_amount = initial_base_amount;
    amm_data.amm_quote_amount = initial_quote_amount;
    amm_data.start_time = clock.unix_timestamp as u64;

    // check if we have the trade2earn plugin
    if amm_data.plugins.len() > 0 {
        match amm_data.plugins[0] {
            AMMPlugin::TradeToEarn(ref mut args) => {
                let rewards_token_frac: f64 = launch_data.distribution[launch::Distribution::MMRewards as usize] as f64 / 100.0;

                let rewards_amount: u64 = (rewards_token_frac * total_token_amount) as u64;
                utils::transfer_tokens(
                    base_2022,
                    rewards_amount,
                    ctx.accounts.cook_base_token,
                    ctx.accounts.base_token_mint,
                    ctx.accounts.trade_to_earn,
                    ctx.accounts.cook_pda,
                    ctx.accounts.base_token_program,
                    pda_sol_bump_seed,
                    &vec![&accounts::SOL_SEED.to_le_bytes()],
                    base_mint.base.decimals,
                    &transfer_hook_accounts,
                )?;

                let actual_amount = utils::get_token_balance(ctx.accounts.trade_to_earn);
                args.total_tokens = actual_amount;
                args.first_reward_date = ((clock.unix_timestamp as u64) / (24 * 60 * 60)) as u32;
                args.last_reward_date = 100;
                amm_data.plugins[0] = AMMPlugin::TradeToEarn(*args);
            }
            _ => {}
        }
    }
    amm_data.serialize(&mut &mut ctx.accounts.amm.data.borrow_mut()[..])?;

    msg!("initial balances {} {} {}", base_float_amount, quote_float_amount, price);

    let minute = clock.unix_timestamp / 60;

    let candle: OHLCV = OHLCV {
        timestamp: minute,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0.0,
    };

    let time_series = TimeSeriesData {
        account_type: state::AccountType::TimeSeries,
        data: vec![candle],
    };

    let price_data_size = to_vec(&time_series).unwrap().len();

    utils::create_program_account(
        ctx.accounts.user,
        ctx.accounts.price_data,
        program_id,
        price_data_bump_seed,
        price_data_size,
        vec![&ctx.accounts.amm.key.to_bytes(), &num_price_accounts.to_le_bytes(), b"TimeSeries"],
    )?;

    time_series.serialize(&mut &mut ctx.accounts.price_data.data.borrow_mut()[..])?;

    launch_data.serialize(&mut &mut ctx.accounts.launch_data.data.borrow_mut()[..])?;
    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    // finally create the LP token
    create_lp_mint(
        ctx.accounts.user,
        ctx.accounts.amm,
        ctx.accounts.lp_token_mint,
        ctx.accounts.base_token_program,
        ctx.accounts.cook_pda,
        &quote_mint,
        lp_bump_seed,
        pda_sol_bump_seed,
    )?;

    Ok(())
}
