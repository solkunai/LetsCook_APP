use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::clock::Clock;
use solana_program::msg;
use solana_program::program_error::ProgramError;
use solana_program::sysvar::Sysvar;
use spl_token_2022::extension::StateWithExtensions;

use crate::amm::get_amm_seeds;
use crate::amm::{get_amm_plugin_map, AMMPlugin, AMMPluginType, TradeToEarn, AMM};
use crate::instruction::AddTradeRewardsArgs;
use crate::utils::{self};
use crate::{accounts, instruction::accounts::AddTradeRewardsAccounts};
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, pubkey::Pubkey};

pub fn add_rewards<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: AddTradeRewardsArgs) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<AddTradeRewardsAccounts> = AddTradeRewardsAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
    get_amm_seeds(*ctx.accounts.base_token_mint.key, *ctx.accounts.quote_token_mint.key, &mut amm_seed_keys);

    let amm_bump_seed = accounts::check_program_data_account(
        ctx.accounts.amm,
        program_id,
        vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), b"CookAMM"],
    )
    .unwrap();

    let trade_to_earn_bump = accounts::check_program_data_account(
        ctx.accounts.trade_to_earn,
        program_id,
        vec![&ctx.accounts.amm.key.to_bytes(), b"TradeToEarn"],
    )
    .unwrap();

    accounts::check_token_account(
        ctx.accounts.user,
        ctx.accounts.base_token_mint,
        ctx.accounts.user_base,
        ctx.accounts.base_token_program,
    )?;

    let base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;

    let base_mint_data = ctx.accounts.base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;

    let mut amm_data = AMM::try_from_slice(&ctx.accounts.amm.data.borrow()[..])?;

    if amm_data.base_mint != *ctx.accounts.base_token_mint.key {
        msg!("token mint does not match amm");
        return Err(ProgramError::InvalidAccountData);
    }
    let amm_plugins = get_amm_plugin_map(&amm_data.plugins);

    let trade_rewards = amm_plugins.get(&AMMPluginType::TradeToEarn);

    // if we dont have one this is easy
    if trade_rewards.is_none() {
        utils::create_token_account(
            ctx.accounts.user,
            ctx.accounts.trade_to_earn,
            ctx.accounts.base_token_mint,
            ctx.accounts.base_token_program,
            ctx.accounts.amm,
            trade_to_earn_bump,
            vec![&ctx.accounts.amm.key.to_bytes(), b"TradeToEarn"],
        )?;

        utils::transfer_tokens(
            base_2022,
            args.amount,
            ctx.accounts.user_base,
            ctx.accounts.base_token_mint,
            ctx.accounts.trade_to_earn,
            ctx.accounts.user,
            ctx.accounts.base_token_program,
            amm_bump_seed,
            &vec![],
            base_mint.base.decimals,
            &transfer_hook_accounts,
        )?;

        let clock = Clock::get()?;

        let actual_amount = utils::get_token_balance(ctx.accounts.trade_to_earn);
        let date = ((clock.unix_timestamp as u64) / (24 * 60 * 60)) as u32;

        let trade_to_earn = AMMPlugin::TradeToEarn(TradeToEarn {
            total_tokens: actual_amount,
            first_reward_date: date,
            last_reward_date: 100, // special value to indicate no trades have been made since adding
        });

        let mut plugin_vec: Vec<AMMPlugin> = amm_data.plugins.clone();

        plugin_vec.push(trade_to_earn);
        amm_data.plugins = plugin_vec;

        utils::check_for_realloc(
            ctx.accounts.amm,
            ctx.accounts.user,
            ctx.accounts.amm.data_len(),
            to_vec(&amm_data).unwrap().len(),
        )?;

        amm_data.serialize(&mut &mut ctx.accounts.amm.data.borrow_mut()[..])?;

        return Ok(());
    }

    Ok(())
}
