use borsh::{BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, instruction, msg, program::invoke, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::utils;
use crate::{
    accounts,
    amm::{get_amm_plugin_map, AMMPlugin, AMMPluginType, TradeToEarn, AMM},
    instruction::{accounts::SwapRaydiumAccounts, RaydiumSwapArgs},
};
use crate::{amm::reward_schedule, state};

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct RaydiumSwap {
    pub discriminator: [u8; 8],
    pub in_amount: u64,
    pub out_amount: u64,
}

pub fn raydium_swap<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: RaydiumSwapArgs) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<SwapRaydiumAccounts> = SwapRaydiumAccounts::context(accounts)?;

    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.user,
        ctx.accounts.mint_input,
        ctx.accounts.user_input,
        ctx.accounts.token_program_input,
    )?;

    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.user,
        ctx.accounts.mint_output,
        ctx.accounts.user_output,
        ctx.accounts.token_program_output,
    )?;

    let account_metas = vec![
        instruction::AccountMeta::new(*ctx.accounts.user.key, true),
        instruction::AccountMeta::new_readonly(*ctx.accounts.authority.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.amm_config.key, false),
        instruction::AccountMeta::new(*ctx.accounts.pool_state.key, false),
        instruction::AccountMeta::new(*ctx.accounts.user_input.key, false),
        instruction::AccountMeta::new(*ctx.accounts.user_output.key, false),
        instruction::AccountMeta::new(*ctx.accounts.amm_input.key, false),
        instruction::AccountMeta::new(*ctx.accounts.amm_output.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.token_program_input.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.token_program_output.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.mint_input.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.mint_output.key, false),
        instruction::AccountMeta::new(*ctx.accounts.observation.key, false),
    ];

    let new_args = RaydiumSwap {
        discriminator: args.discriminator,
        in_amount: args.in_amount,
        out_amount: args.out_amount,
    };

    let mut instr_in_bytes: Vec<u8> = Vec::new();
    new_args.serialize(&mut instr_in_bytes)?;

    let instruction = instruction::Instruction::new_with_bytes(*ctx.accounts.raydium_program.key, &instr_in_bytes, account_metas);

    msg!("call into raydium program");
    invoke(
        &instruction,
        &[
            ctx.accounts.user.clone(),
            ctx.accounts.authority.clone(),
            ctx.accounts.amm_config.clone(),
            ctx.accounts.pool_state.clone(),
            ctx.accounts.user_input.clone(),
            ctx.accounts.user_output.clone(),
            ctx.accounts.amm_input.clone(),
            ctx.accounts.amm_output.clone(),
            ctx.accounts.token_program_input.clone(),
            ctx.accounts.token_program_output.clone(),
            ctx.accounts.mint_input.clone(),
            ctx.accounts.mint_output.clone(),
            ctx.accounts.observation.clone(),
        ],
    )?;

    // now sort out the rewards if it was a buy
    if args.side != 0 {
        return Ok(());
    }

    let mut amm_data = AMM::try_from_slice(&ctx.accounts.cook_amm.data.borrow()[..])?;

    // check if we have the TradeToEarn plugin
    let plugin_map = get_amm_plugin_map(&amm_data.plugins.clone());
    let plugin_option = plugin_map.get(&AMMPluginType::TradeToEarn);

    if plugin_option.is_none() {
        return Ok(());
    }

    let option = match plugin_option.unwrap() {
        AMMPlugin::TradeToEarn(args) => Some(args),
        _ => None,
    };

    let clock = Clock::get()?;

    // we only need to create or update MM accounts if we are less than 30 days since launch
    if option.is_some() {
        let mut trade_to_earn: TradeToEarn = option.unwrap().clone();

        let current_date = ((clock.unix_timestamp as u64) / (24 * 60 * 60)) as u32;
        let days_since_launch = current_date - trade_to_earn.first_reward_date;

        let valid_date: bool = days_since_launch < 30;

        if !valid_date {
            amm_data.serialize(&mut &mut ctx.accounts.cook_amm.data.borrow_mut()[..])?;
            return Ok(());
        }

        msg!("have date {}", days_since_launch);
        let launch_date_bump_seed = accounts::check_program_data_account(
            ctx.accounts.launch_rewards,
            program_id,
            vec![&ctx.accounts.cook_amm.key.to_bytes(), &days_since_launch.to_le_bytes(), b"LaunchDate"],
        )
        .unwrap();

        let user_date_bump_seed = accounts::check_program_data_account(
            ctx.accounts.user_rewards,
            program_id,
            vec![
                &ctx.accounts.cook_amm.key.to_bytes(),
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
                &ctx.accounts.cook_amm.key.to_bytes(),
                &ctx.accounts.user.key.to_bytes(),
                &days_since_launch.to_le_bytes(),
            ],
        )?;

        let mut user_mm_data = state::MMUserData::try_from_slice(&ctx.accounts.user_rewards.data.borrow()[..])?;

        // if we just created the user data then set it up
        if user_mm_data.account_type != state::AccountType::MMUserData {
            user_mm_data.account_type = state::AccountType::MMUserData;
            user_mm_data.user_key = *ctx.accounts.user.key;
            user_mm_data.amm_key = *ctx.accounts.cook_amm.key;
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
            vec![&ctx.accounts.cook_amm.key.to_bytes(), &days_since_launch.to_le_bytes(), b"LaunchDate"],
        )?;

        let mut launch_mm_data = state::MMLaunchData::try_from_slice(&ctx.accounts.launch_rewards.data.borrow()[..])?;

        // if we just created the user data then set it up
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
            launch_mm_data.amm_key = *ctx.accounts.cook_amm.key;
            launch_mm_data.date = days_since_launch;
            launch_mm_data.token_rewards = token_reward as u64;
            launch_mm_data.buy_amount = 0;
            launch_mm_data.amount_distributed = 0;
            launch_mm_data.fraction_distributed = 0 as f64;
        }

        launch_mm_data.buy_amount += args.out_amount;
        user_mm_data.buy_amount += args.out_amount;

        user_mm_data.serialize(&mut &mut ctx.accounts.user_rewards.data.borrow_mut()[..])?;
        launch_mm_data.serialize(&mut &mut ctx.accounts.launch_rewards.data.borrow_mut()[..])?;

        trade_to_earn.last_reward_date = days_since_launch;

        amm_data.plugins[0] = AMMPlugin::TradeToEarn(trade_to_earn);
    }

    amm_data.serialize(&mut &mut ctx.accounts.cook_amm.data.borrow_mut()[..])?;

    Ok(())
}
