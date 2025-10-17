use borsh::{BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};
use spl_token_2022::extension::StateWithExtensions;

use crate::amm::{get_amm_plugin_map, get_amm_seeds, AMMPlugin, AMMPluginType, TradeToEarn, AMM};
use crate::state;
use crate::{accounts, instruction::accounts::GetMMRewardTokensAccounts};
use crate::{instruction::GetMMRewardArgs, utils};

pub fn get_mm_rewards<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: GetMMRewardArgs) -> ProgramResult {
    msg!("in get mm rewrds");

    let ctx: crate::instruction::accounts::Context<GetMMRewardTokensAccounts> = GetMMRewardTokensAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let _user_pda_bump =
        accounts::check_program_data_account(ctx.accounts.user_pda, program_id, vec![&ctx.accounts.user.key.to_bytes(), b"User_PDA"]).unwrap();

    accounts::check_token_account(
        ctx.accounts.user,
        ctx.accounts.base_token_mint,
        ctx.accounts.user_base_token,
        ctx.accounts.base_token_program,
    )?;

    let _sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
    get_amm_seeds(*ctx.accounts.base_token_mint.key, *ctx.accounts.quote_token_mint.key, &mut amm_seed_keys);

    let amm_provider_bytes: &[u8] = if args.amm_provider == 0 {
        b"CookAMM"
    } else if args.amm_provider == 1 {
        b"RaydiumCPMM"
    } else {
        b"Raydium"
    };

    let amm_bump_seed = accounts::check_program_data_account(
        ctx.accounts.amm,
        program_id,
        vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), amm_provider_bytes],
    )
    .unwrap();

    let _trade_to_earn_bump = accounts::check_program_data_account(
        ctx.accounts.trade_to_earn,
        program_id,
        vec![&ctx.accounts.amm.key.to_bytes(), b"TradeToEarn"],
    )
    .unwrap();

    let amm_data = AMM::try_from_slice(&ctx.accounts.amm.data.borrow()[..])?;

    let _launch_date_bump_seed = accounts::check_program_data_account(
        ctx.accounts.launch_rewards,
        program_id,
        vec![&ctx.accounts.amm.key.to_bytes(), &args.date.to_le_bytes(), b"LaunchDate"],
    )
    .unwrap();

    let _user_date_bump_seed = accounts::check_program_data_account(
        ctx.accounts.user_rewards,
        program_id,
        vec![
            &ctx.accounts.amm.key.to_bytes(),
            &ctx.accounts.user.key.to_bytes(),
            &args.date.to_le_bytes(),
        ],
    )
    .unwrap();

    if *ctx.accounts.base_token_mint.key != amm_data.base_mint {
        msg!("Mint address account does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    accounts::check_system_program_key(ctx.accounts.system_program)?;
    let base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;

    if **ctx.accounts.launch_rewards.try_borrow_lamports()? == 0 {
        msg!("Launch date account does not exist");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut launch_mm_data = state::MMLaunchData::try_from_slice(&ctx.accounts.launch_rewards.data.borrow()[..])?;

    if launch_mm_data.token_rewards == 0 {
        msg!("Launch has zero tokens");
        return Err(ProgramError::InvalidAccountData);
    }

    if **ctx.accounts.user_rewards.try_borrow_lamports()? == 0 {
        msg!("User date account does not exist");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut user_mm_data = state::MMUserData::try_from_slice(&ctx.accounts.user_rewards.data.borrow()[..])?;

    if user_mm_data.buy_amount == 0 {
        msg!("User has zero tokens");
        return Err(ProgramError::InvalidAccountData);
    }

    let plugin_map = get_amm_plugin_map(&amm_data.plugins.clone());
    let plugin_option = plugin_map.get(&AMMPluginType::TradeToEarn);
    if plugin_option.is_none() {
        msg!("Trade to earn plugin not found");
        return Err(ProgramError::InvalidAccountData);
    }

    let option = match plugin_option.unwrap() {
        AMMPlugin::TradeToEarn(args) => Some(args),
        _ => None,
    };

    let trade_to_earn: TradeToEarn = option.unwrap().clone();

    let clock = Clock::get()?;
    let current_date = ((clock.unix_timestamp as u64) / (24 * 60 * 60)) as u32;

    let days_since_launch = current_date - trade_to_earn.first_reward_date;

    if days_since_launch == args.date {
        msg!("cannot collect rewards on the same day they are due");
        return Err(ProgramError::InvalidAccountData);
    }

    let base_mint_data = ctx.accounts.base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;

    let total_tokens = launch_mm_data.token_rewards as f64;

    let total_buy_tokens = launch_mm_data.buy_amount as f64;
    let user_buy_tokens = user_mm_data.buy_amount as f64;

    let user_percent: f64 = user_buy_tokens / total_buy_tokens;
    let mut total_percent: f64 = launch_mm_data.fraction_distributed + user_percent;
    if total_percent > 1.0 {
        total_percent = 1.0;
    }

    let total_distributed: u64 = (total_percent * total_tokens + 0.5) as u64;

    let user_rewards: u64 = total_distributed - launch_mm_data.amount_distributed;

    msg!(
        "Distributing rewards: user_percent {} total_percent {} total_dist {} user_dist {}",
        user_percent,
        total_percent,
        total_distributed,
        user_rewards
    );

    if user_rewards > 0 {
        utils::transfer_tokens(
            base_2022,
            user_rewards,
            ctx.accounts.trade_to_earn,
            ctx.accounts.base_token_mint,
            ctx.accounts.user_base_token,
            ctx.accounts.amm,
            ctx.accounts.base_token_program,
            amm_bump_seed,
            &vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), amm_provider_bytes],
            base_mint.base.decimals,
            &transfer_hook_accounts,
        )?;
    }

    // update the users data just to be sure
    user_mm_data.buy_amount = 0;
    user_mm_data.serialize(&mut &mut ctx.accounts.user_rewards.data.borrow_mut()[..])?;

    launch_mm_data.fraction_distributed = total_percent;
    launch_mm_data.amount_distributed = total_distributed;

    launch_mm_data.serialize(&mut &mut ctx.accounts.launch_rewards.data.borrow_mut()[..])?;

    if launch_mm_data.amount_distributed >= launch_mm_data.token_rewards {
        // close the launch date account

        let date_account_lamports = **ctx.accounts.launch_rewards.try_borrow_lamports()?;
        msg!("last rewards claimed, transfer {} lamports", date_account_lamports);
        **ctx.accounts.launch_rewards.try_borrow_mut_lamports()? -= date_account_lamports;
        **ctx.accounts.cook_pda.try_borrow_mut_lamports()? += date_account_lamports;
    }

    // close the users date account
    let date_account_lamports = **ctx.accounts.user_rewards.try_borrow_lamports()?;

    **ctx.accounts.user_rewards.try_borrow_mut_lamports()? -= date_account_lamports;
    **ctx.accounts.user.try_borrow_mut_lamports()? += date_account_lamports;

    Ok(())
}
