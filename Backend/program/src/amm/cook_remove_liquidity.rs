use borsh::{BorshDeserialize, BorshSerialize};

use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey};

use spl_token_2022::extension::StateWithExtensions;

use crate::accounts;
use crate::amm::{get_amm_plugin_map, get_amm_seeds, AMMPlugin, AMMPluginType, LiquidityScaling, AMM};
use crate::instruction::accounts::RemoveCookLiquidityAccounts;
use crate::instruction::CookSwapArgs;
use crate::utils;

pub fn remove_liquidity<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: CookSwapArgs) -> ProgramResult {
    msg!("in update_liquidity");
    let ctx: crate::instruction::accounts::Context<RemoveCookLiquidityAccounts> = RemoveCookLiquidityAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }
    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
    get_amm_seeds(*ctx.accounts.base_token_mint.key, *ctx.accounts.quote_token_mint.key, &mut amm_seed_keys);

    let amm_bump_seed = accounts::check_program_data_account(
        ctx.accounts.amm,
        program_id,
        vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), b"CookAMM"],
    )
    .unwrap();

    let _pda_sol_bump_seed =
        accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let temp_account_bump =
        accounts::check_program_data_account(ctx.accounts.temp_wsol, program_id, vec![&ctx.accounts.user.key.to_bytes(), b"Temp"]).unwrap();

    let base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;
    let _quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;

    let base_mint_data = ctx.accounts.base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;

    let mut amm_data = AMM::try_from_slice(&ctx.accounts.amm.data.borrow()[..])?;

    let amm_base_amount = utils::get_token_balance(ctx.accounts.amm_base);
    let amm_quote_amount = utils::get_token_balance(ctx.accounts.amm_quote);
    let amm_lp_amount = amm_data.lp_amount as f64;

    let lp_to_remove = args.in_amount as f64;
    let base_to_remove = ((amm_base_amount as f64) * lp_to_remove / amm_lp_amount) as u64;
    let quote_to_remove = ((amm_quote_amount as f64) * lp_to_remove / amm_lp_amount) as u64;

    if amm_base_amount.saturating_sub(base_to_remove) < 100 {
        msg!("Base quantity reduced below threshold");
        return Err(ProgramError::InvalidAccountData);
    }

    if amm_quote_amount.saturating_sub(quote_to_remove) < 100 {
        msg!("Quote quantity reduced below threshold");
        return Err(ProgramError::InvalidAccountData);
    }

    utils::unwrap_wsol(
        quote_to_remove as u64,
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

    utils::transfer_tokens(
        base_2022,
        base_to_remove as u64,
        ctx.accounts.amm_base,
        ctx.accounts.base_token_mint,
        ctx.accounts.user_base,
        ctx.accounts.amm,
        ctx.accounts.base_token_program,
        amm_bump_seed,
        &vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), b"CookAMM"],
        base_mint.base.decimals,
        &transfer_hook_accounts,
    )?;

    utils::burn(
        args.in_amount,
        ctx.accounts.base_token_program,
        ctx.accounts.lp_token_mint,
        ctx.accounts.user_lp,
        ctx.accounts.user,
        0,
        &Vec::new(),
    )?;

    amm_data.amm_base_amount = amm_data.amm_base_amount.saturating_sub(base_to_remove);
    amm_data.amm_quote_amount = amm_data.amm_quote_amount.saturating_sub(quote_to_remove);
    amm_data.lp_amount = amm_data.lp_amount.saturating_sub(args.in_amount);

    // if this pool has a liquidity plugin and the removal of this liquidity drops us below the threshold, reactive it if it wasn't already
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

        if amm_data.amm_quote_amount < liquidity_plugin.threshold && liquidity_plugin.active == 0 {
            liquidity_plugin.active = 1;
            if let Some(plugin) = amm_data.plugins.iter_mut().find(|p| matches!(p, AMMPlugin::LiquidityScaling(_))) {
                *plugin = AMMPlugin::LiquidityScaling(liquidity_plugin);
            }
        }
    }

    amm_data.serialize(&mut &mut ctx.accounts.amm.data.borrow_mut()[..])?;

    return Ok(());
}
