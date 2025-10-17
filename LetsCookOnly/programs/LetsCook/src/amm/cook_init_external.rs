use borsh::{to_vec, BorshDeserialize, BorshSerialize};

use solana_program::program::invoke_signed;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey};
use spl_token_2022::extension::StateWithExtensions;

use crate::amm::create_amm;
use crate::amm::create_lp_mint;
use crate::amm::get_amm_seeds;
use crate::amm::init_cook_amm_data;
use crate::instruction::InitCookAMMExternalArgs;
use crate::launch::Listing;
use crate::state;
use crate::state::Socials;
use crate::utils;
use crate::{accounts, instruction::accounts::InitCookAMMExternalAccounts};

pub fn init_amm_external<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: InitCookAMMExternalArgs) -> ProgramResult {
    msg!("in init_amm, getting accounts");

    let ctx: crate::instruction::accounts::Context<InitCookAMMExternalAccounts> = InitCookAMMExternalAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let listing_bump_seed = accounts::check_program_data_account(
        ctx.accounts.listing,
        program_id,
        vec![&ctx.accounts.base_token_mint.key.to_bytes(), b"Listing"],
    )
    .unwrap();

    utils::create_user_data(ctx.accounts.user, ctx.accounts.user_data, program_id)?;

    let mut user_data = state::UserData::try_from_slice(&ctx.accounts.user_data.data.borrow()[..])?;

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
        ctx.accounts.user,
        ctx.accounts.base_token_mint,
        ctx.accounts.user_base,
        ctx.accounts.base_token_program,
    )?;

    accounts::check_token_account(
        ctx.accounts.user,
        ctx.accounts.quote_token_mint,
        ctx.accounts.user_quote,
        ctx.accounts.quote_token_program,
    )?;

    let lp_bump_seed =
        accounts::check_program_data_account(ctx.accounts.lp_token_mint, program_id, vec![&ctx.accounts.amm.key.to_bytes(), b"LP"]).unwrap();

    accounts::check_wrapped_sol_key(ctx.accounts.quote_token_mint)?;

    if **ctx.accounts.amm.try_borrow_lamports()? > 0 {
        msg!("amm already exists for this token");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let base_mint_data = ctx.accounts.base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;

    if **ctx.accounts.listing.try_borrow_lamports()? == 0 {
        let mut listing = Listing {
            account_type: state::AccountType::Listing,
            id: 0,
            mint: *ctx.accounts.base_token_mint.key,
            name: args.name,
            symbol: args.symbol,
            decimals: base_mint.base.decimals,
            icon_url: args.icon,
            meta_url: args.uri,
            banner_url: "".to_string(),
            description: "".to_string(),
            positive_votes: 0,
            negative_votes: 0,
            socials: Vec::with_capacity(state::Socials::LENGTH as usize),
        };
        listing.socials = vec!["".to_string(); state::Socials::LENGTH as usize];

        listing.socials[Socials::Website as usize] = args.website;
        listing.socials[Socials::Twitter as usize] = args.twitter;
        listing.socials[Socials::Telegram as usize] = args.telegram;
        listing.socials[Socials::Discord as usize] = args.discord;

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
    }

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
        0,
        args.low_liqudity == 1,
    )?;

    // get the mint data for the base and quote mints
    let base_mint_data = ctx.accounts.base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;
    let quote_mint_data = ctx.accounts.quote_token_mint.data.borrow();
    let quote_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&quote_mint_data)?;

    msg!("transfer base token to AMM");
    utils::transfer_tokens(
        base_2022,
        args.base_amount,
        ctx.accounts.user_base,
        ctx.accounts.base_token_mint,
        ctx.accounts.amm_base,
        ctx.accounts.user,
        ctx.accounts.base_token_program,
        pda_sol_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        base_mint.base.decimals,
        &transfer_hook_accounts,
    )?;

    msg!("transfer quote token to AMM");

    if args.wrap == 1 && ctx.accounts.quote_token_mint.key == &accounts::wrapped_sol_mint_account::ID {
        utils::wrap_sol(
            args.quote_amount,
            ctx.accounts.user,
            ctx.accounts.amm_quote,
            ctx.accounts.quote_token_program,
        )?;
    } else {
        utils::transfer_tokens(
            quote_2022,
            args.quote_amount,
            ctx.accounts.user_quote,
            ctx.accounts.quote_token_mint,
            ctx.accounts.amm_quote,
            ctx.accounts.user,
            ctx.accounts.quote_token_program,
            pda_sol_bump_seed,
            &vec![&accounts::SOL_SEED.to_le_bytes()],
            quote_mint.base.decimals,
            &transfer_hook_accounts,
        )?;
    }

    // update the users points
    user_data.total_points += 100;
    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    let lp_generated = init_cook_amm_data(
        ctx.accounts.user,
        ctx.accounts.amm,
        ctx.accounts.amm_quote,
        ctx.accounts.amm_base,
        ctx.accounts.price_data,
        ctx.accounts.base_token_mint,
        ctx.accounts.quote_token_mint,
        program_id,
        price_data_bump_seed,
        num_price_accounts,
    )?;

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

    if args.burn_lp == 1 {
        return Ok(());
    }

    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.user,
        ctx.accounts.lp_token_mint,
        ctx.accounts.user_lp,
        ctx.accounts.base_token_program,
    )?;

    // mint the lp for the user
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

    Ok(())
}
