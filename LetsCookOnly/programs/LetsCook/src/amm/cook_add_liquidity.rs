use ::borsh::{BorshDeserialize, BorshSerialize};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use spl_token_2022::extension::StateWithExtensions;

use crate::amm::get_amm_seeds;

use crate::amm::AMM;
use crate::instruction::CookSwapArgs;
use crate::utils;
use crate::utils::get_amount_post_transfer_fee;
use crate::utils::get_amount_pre_transfer_fee;
use crate::{accounts, instruction::accounts::AddCookLiquidityAccounts};

pub fn add_liquidity<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: CookSwapArgs) -> ProgramResult {
    msg!("in update_liquidity");
    let ctx: crate::instruction::accounts::Context<AddCookLiquidityAccounts> = AddCookLiquidityAccounts::context(accounts)?;

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

    let _lp_bump_seed =
        accounts::check_program_data_account(ctx.accounts.lp_token_mint, program_id, vec![&ctx.accounts.amm.key.to_bytes(), b"LP"]).unwrap();

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;
    let _quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;

    let mut amm_data = AMM::try_from_slice(&ctx.accounts.amm.data.borrow()[..])?;

    let amm_base_amount = utils::get_token_balance(ctx.accounts.amm_base);
    let amm_quote_amount = utils::get_token_balance(ctx.accounts.amm_quote);

    let base_mint_data = ctx.accounts.base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;

    let quote_mint_data = ctx.accounts.quote_token_mint.data.borrow();
    let quote_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&quote_mint_data)?;

    let base_added = get_amount_post_transfer_fee(args.in_amount, ctx.accounts.base_token_mint)?;

    let quote_added = ((base_added as f64) * (amm_quote_amount as f64) / ((base_added as f64) + (amm_base_amount as f64))) as u64;

    if quote_added == 0 {
        msg!("Quantisation has reduced output to zero");
        return Err(ProgramError::InvalidAccountData);
    }

    let quote_to_transfer = get_amount_pre_transfer_fee(quote_added, ctx.accounts.quote_token_mint)?;

    let lp_generated = ((amm_data.lp_amount as f64) * (base_added as f64) / (amm_base_amount as f64)) as u64;

    msg!("{} {} {} {}", amm_data.lp_amount, base_added, amm_base_amount, lp_generated);

    utils::wrap_sol(
        quote_to_transfer,
        ctx.accounts.user,
        ctx.accounts.amm_quote,
        ctx.accounts.quote_token_program,
    )?;

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
        base_mint.base.decimals,
        &transfer_hook_accounts,
    )?;

    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.user,
        ctx.accounts.lp_token_mint,
        ctx.accounts.user_lp,
        ctx.accounts.base_token_program,
    )?;

    let mint_to_idx = spl_token_2022::instruction::mint_to_checked(
        ctx.accounts.base_token_program.key,
        ctx.accounts.lp_token_mint.key,
        ctx.accounts.user_lp.key,
        ctx.accounts.cook_pda.key,
        &[ctx.accounts.cook_pda.key],
        lp_generated,
        quote_mint.base.decimals,
    )
    .unwrap();

    invoke_signed(
        &mint_to_idx,
        &[
            ctx.accounts.base_token_program.clone(),
            ctx.accounts.lp_token_mint.clone(),
            ctx.accounts.user_lp.clone(),
            ctx.accounts.user.clone(),
            ctx.accounts.cook_pda.clone(),
        ],
        &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]],
    )?;

    amm_data.amm_base_amount = amm_data.amm_base_amount.saturating_add(base_added);
    amm_data.amm_quote_amount = amm_data.amm_quote_amount.saturating_add(quote_added);

    amm_data.lp_amount = amm_data.lp_amount.saturating_add(lp_generated);
    amm_data.serialize(&mut &mut ctx.accounts.amm.data.borrow_mut()[..])?;

    return Ok(());
}
