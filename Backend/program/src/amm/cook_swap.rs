use borsh::{BorshDeserialize, BorshSerialize};

use solana_program::program::invoke;
use solana_program::system_instruction;
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::amm::{
    check_swap, get_amm_plugin_map, get_amm_seeds, get_price, update_price_account, AMMPlugin, AMMPluginType, LiquidityScaling, TradeToEarn, AMM,
};
use crate::instruction::{accounts::SwapCookAMMAccounts, PlaceOrderArgs};
use crate::state;
use crate::utils;
use crate::{accounts, amm::reward_schedule};

pub fn perform_swap<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: PlaceOrderArgs) -> ProgramResult {
    msg!("in perform_swap, getting accounts");

    let ctx: crate::instruction::accounts::Context<SwapCookAMMAccounts> = SwapCookAMMAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }
    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut amm_data = AMM::try_from_slice(&ctx.accounts.amm.data.borrow()[..])?;

    if *ctx.accounts.base_token_mint.key != amm_data.base_mint {
        msg!("Mint address account does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    let temp_account_bump =
        accounts::check_program_data_account(ctx.accounts.temp_wsol, program_id, vec![&ctx.accounts.user.key.to_bytes(), b"Temp"]).unwrap();

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
    get_amm_seeds(*ctx.accounts.base_token_mint.key, *ctx.accounts.quote_token_mint.key, &mut amm_seed_keys);

    let amm_bump_seed = accounts::check_program_data_account(
        ctx.accounts.amm,
        program_id,
        vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), b"CookAMM"],
    )
    .unwrap();

    let _trade_to_earn_bump = accounts::check_program_data_account(
        ctx.accounts.trade_to_earn,
        program_id,
        vec![&ctx.accounts.amm.key.to_bytes(), b"TradeToEarn"],
    )
    .unwrap();

    accounts::check_wrapped_sol_key(ctx.accounts.quote_token_mint)?;
    let base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;
    let _quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;

    utils::create_user_data(ctx.accounts.user, ctx.accounts.user_data, program_id)?;

    let mut user_data = state::UserData::try_from_slice(&ctx.accounts.user_data.data.borrow()[..])?;
    user_data.total_points += 2;
    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    // check if we need to get a factor for the liquidity scaling plugin
    // check if we have the liquidity scaling plugin
    let plugin_map = get_amm_plugin_map(&amm_data.plugins.clone());

    let plugin_option = plugin_map.get(&AMMPluginType::LiquidityScaling);

    let liquidity_plugin_option = match plugin_option {
        Some(plugin) => match plugin {
            AMMPlugin::LiquidityScaling(args) => Some(args),
            _ => None,
        },
        None => None,
    };

    if liquidity_plugin_option.is_some() {
        let mut liquidity_plugin: LiquidityScaling = liquidity_plugin_option.unwrap().clone();

        if amm_data.amm_quote_amount >= liquidity_plugin.threshold {
            liquidity_plugin.active = 0;
            if let Some(plugin) = amm_data.plugins.iter_mut().find(|p| matches!(p, AMMPlugin::LiquidityScaling(_))) {
                *plugin = AMMPlugin::LiquidityScaling(liquidity_plugin);
            }
        }

        /*if ctx.accounts.user.key == &accounts::daoplays_account::ID {
            liquidity_plugin.active = 0;
            if let Some(plugin) = amm_data.plugins.iter_mut().find(|p| matches!(p, AMMPlugin::LiquidityScaling(_))) {
                *plugin = AMMPlugin::LiquidityScaling(liquidity_plugin);
            }
        }*/
    }

    let mut in_amount = args.in_amount;
    let mut cook_fees: u64 = 0;
    if args.side == 0 {
        cook_fees = ((args.in_amount as f64) * 0.0005) as u64;
        in_amount = in_amount.saturating_sub(cook_fees);
    }

    let (base_amount, quote_amount, base_float_amount, base_decimals, quote_decimals) = check_swap(
        amm_data.amm_base_amount,
        amm_data.amm_quote_amount,
        ctx.accounts.base_token_mint,
        ctx.accounts.quote_token_mint,
        in_amount,
        amm_data.fee,
        args.side,
        true,
        liquidity_plugin_option,
    )?;

    if args.side == 0 {
        // create the ATA for the user
        utils::check_and_create_ata(
            ctx.accounts.user,
            ctx.accounts.user,
            ctx.accounts.base_token_mint,
            ctx.accounts.user_base,
            ctx.accounts.base_token_program,
        )?;

        utils::wrap_sol(in_amount, ctx.accounts.user, ctx.accounts.amm_quote, ctx.accounts.quote_token_program)?;

        // and then the fees
        invoke(
            &system_instruction::transfer(ctx.accounts.user.key, &ctx.accounts.cook_fees.key, cook_fees),
            &[ctx.accounts.user.clone(), ctx.accounts.cook_fees.clone()],
        )?;

        utils::transfer_tokens(
            base_2022,
            base_amount,
            ctx.accounts.amm_base,
            ctx.accounts.base_token_mint,
            ctx.accounts.user_base,
            ctx.accounts.amm,
            ctx.accounts.base_token_program,
            amm_bump_seed,
            &vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), b"CookAMM"],
            base_decimals,
            &transfer_hook_accounts,
        )?;

        //update the amounts in the data
        amm_data.amm_base_amount = amm_data.amm_base_amount.saturating_sub(base_amount);
        amm_data.amm_quote_amount = amm_data.amm_quote_amount.saturating_add(quote_amount);
    } else {
        utils::transfer_tokens(
            base_2022,
            args.in_amount,
            ctx.accounts.user_base,
            ctx.accounts.base_token_mint,
            ctx.accounts.amm_base,
            ctx.accounts.user,
            ctx.accounts.base_token_program,
            amm_bump_seed,
            &vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), b"CookAMM"],
            base_decimals,
            &transfer_hook_accounts,
        )?;

        let cook_fees = ((quote_amount as f64) * 0.0005) as u64;

        // transfer the part to the user
        utils::unwrap_wsol(
            quote_amount,
            ctx.accounts.user,
            ctx.accounts.user,
            ctx.accounts.temp_wsol,
            ctx.accounts.amm,
            ctx.accounts.amm_quote,
            ctx.accounts.quote_token_mint,
            ctx.accounts.quote_token_program,
            amm_bump_seed,
            &vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), b"CookAMM"],
            temp_account_bump,
        )?;

        // and then the fees
        invoke(
            &system_instruction::transfer(ctx.accounts.user.key, &ctx.accounts.cook_fees.key, cook_fees),
            &[ctx.accounts.user.clone(), ctx.accounts.cook_fees.clone()],
        )?;

        amm_data.amm_base_amount = amm_data.amm_base_amount.saturating_add(base_amount);
        amm_data.amm_quote_amount = amm_data.amm_quote_amount.saturating_sub(quote_amount);
    }

    let new_price = get_price(amm_data.amm_base_amount, amm_data.amm_quote_amount, base_decimals, quote_decimals)?;

    msg!(
        "base {} quote {} price {}",
        amm_data.amm_base_amount,
        amm_data.amm_quote_amount,
        new_price
    );

    let clock = Clock::get()?;

    update_price_account(ctx.accounts.user, ctx.accounts.price_data, new_price as f32, base_float_amount as f32)?;

    amm_data.last_price = new_price as f32;

    // check if we have the TradeToEarn plugin
    let plugin_option = plugin_map.get(&AMMPluginType::TradeToEarn);

    if plugin_option.is_none() {
        amm_data.serialize(&mut &mut ctx.accounts.amm.data.borrow_mut()[..])?;
        return Ok(());
    }

    let option = match plugin_option.unwrap() {
        AMMPlugin::TradeToEarn(args) => Some(args),
        _ => None,
    };

    // we only need to create or update MM accounts if we are less than 30 days since launch
    if args.side == 0 && option.is_some() {
        let mut trade_to_earn: TradeToEarn = option.unwrap().clone();

        let current_date = ((clock.unix_timestamp as u64) / (24 * 60 * 60)) as u32;
        let days_since_launch = current_date - trade_to_earn.first_reward_date;

        let valid_date: bool = days_since_launch < 30;

        if !valid_date {
            amm_data.serialize(&mut &mut ctx.accounts.amm.data.borrow_mut()[..])?;
            return Ok(());
        }

        msg!("have date {}", days_since_launch);
        let launch_date_bump_seed = accounts::check_program_data_account(
            ctx.accounts.launch_rewards,
            program_id,
            vec![&ctx.accounts.amm.key.to_bytes(), &days_since_launch.to_le_bytes(), b"LaunchDate"],
        )
        .unwrap();

        let user_date_bump_seed = accounts::check_program_data_account(
            ctx.accounts.user_rewards,
            program_id,
            vec![
                &ctx.accounts.amm.key.to_bytes(),
                &ctx.accounts.user.key.to_bytes(),
                &days_since_launch.to_le_bytes(),
            ],
        )
        .unwrap();

        // check if the user MM data account exists
        utils::create_program_account(
            ctx.accounts.user,
            ctx.accounts.user_rewards,
            program_id,
            user_date_bump_seed,
            state::get_mm_user_data_size(),
            vec![
                &ctx.accounts.amm.key.to_bytes(),
                &ctx.accounts.user.key.to_bytes(),
                &days_since_launch.to_le_bytes(),
            ],
        )?;

        let mut user_mm_data = state::MMUserData::try_from_slice(&ctx.accounts.user_rewards.data.borrow()[..])?;

        // if we just created the user data then set it up
        if user_mm_data.account_type != state::AccountType::MMUserData {
            user_mm_data.account_type = state::AccountType::MMUserData;
            user_mm_data.user_key = *ctx.accounts.user.key;
            user_mm_data.amm_key = *ctx.accounts.amm.key;
            user_mm_data.date = days_since_launch;
            user_mm_data.buy_amount = 0;
            user_mm_data.sell_amount = 0;
        }

        // check if the launch MM data account exists
        utils::create_program_account(
            ctx.accounts.user,
            ctx.accounts.launch_rewards,
            program_id,
            launch_date_bump_seed,
            state::get_mm_launch_data_size(),
            vec![&ctx.accounts.amm.key.to_bytes(), &days_since_launch.to_le_bytes(), b"LaunchDate"],
        )?;

        let mut launch_mm_data = state::MMLaunchData::try_from_slice(&ctx.accounts.launch_rewards.data.borrow()[..])?;

        // if we just created the rewards data then set it up
        if launch_mm_data.account_type != state::AccountType::MMLaunchData {
            let total_token_amount: f64 = trade_to_earn.total_tokens as f64;

            let mut total_reward_schedule: f64 = 0.0;
            let mut last_reward_date = trade_to_earn.last_reward_date;

            msg!("last reward date was {}", last_reward_date);

            if last_reward_date == 100 {
                // noone has traded since we added rewards, so we are still have day 0 rewards
                last_reward_date = 0;
            } else {
                last_reward_date += 1;
            }

            for i in last_reward_date..(days_since_launch + 1) {
                total_reward_schedule += reward_schedule(i);
            }

            msg!(
                "reward schedule from {} -> {} => {}",
                last_reward_date,
                days_since_launch + 1,
                total_reward_schedule
            );

            let token_reward: f64 = total_reward_schedule * total_token_amount;

            launch_mm_data.account_type = state::AccountType::MMLaunchData;
            launch_mm_data.amm_key = *ctx.accounts.amm.key;
            launch_mm_data.date = days_since_launch;
            launch_mm_data.token_rewards = token_reward as u64;
            launch_mm_data.buy_amount = 0;
            launch_mm_data.amount_distributed = 0;
            launch_mm_data.fraction_distributed = 0 as f64;
        }
        trade_to_earn.last_reward_date = days_since_launch;

        if let Some(plugin) = amm_data.plugins.iter_mut().find(|p| matches!(p, AMMPlugin::TradeToEarn(_))) {
            *plugin = AMMPlugin::TradeToEarn(trade_to_earn);
        }

        launch_mm_data.buy_amount += base_amount;
        user_mm_data.buy_amount += base_amount;

        user_mm_data.serialize(&mut &mut ctx.accounts.user_rewards.data.borrow_mut()[..])?;
        launch_mm_data.serialize(&mut &mut ctx.accounts.launch_rewards.data.borrow_mut()[..])?;
    }

    amm_data.serialize(&mut &mut ctx.accounts.amm.data.borrow_mut()[..])?;

    return Ok(());
}
