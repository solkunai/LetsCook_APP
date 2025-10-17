use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::{
    accounts,
    amm::{self, AMM},
    instruction::{accounts::CreateListingAccounts, CreateListingArgs},
    launch::Listing,
    state, utils,
};
pub fn create_listing<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: CreateListingArgs) -> ProgramResult {
    msg!("in create game, getting accounts");

    let ctx: crate::instruction::accounts::Context<CreateListingAccounts> = CreateListingAccounts::context(accounts)?;

    msg!("verify accounts");

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let _unverified_listing_bump = accounts::check_program_data_account(
        ctx.accounts.unverified,
        program_id,
        vec![
            &ctx.accounts.base_token_mint.key.to_bytes(),
            &ctx.accounts.creator.key.to_bytes(),
            b"UnverifiedListing",
        ],
    )
    .unwrap();

    let _pda_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_data, program_id, vec![&accounts::DATA_SEED.to_le_bytes()]).unwrap();

    let _pda_sol_bump_seed =
        accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let _creator_data_bump_seed =
        accounts::check_program_data_account(ctx.accounts.creator_data, program_id, vec![&ctx.accounts.creator.key.to_bytes(), b"User"]);

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    if ctx.accounts.user.key != &accounts::daoplays_account::ID && ctx.accounts.user.key != &accounts::admin2::ID {
        msg!("invalid user");
        return Err(ProgramError::InvalidAccountData);
    }

    // Handle any other checks

    if ctx.accounts.listing.is_none() {
        msg!("Rejecting listing");
        let account_lamports = **ctx.accounts.unverified.try_borrow_lamports()?;
        **ctx.accounts.unverified.try_borrow_mut_lamports()? -= account_lamports;
        **ctx.accounts.user.try_borrow_mut_lamports()? += account_lamports;
        return Ok(());
    }

    let listing_account = ctx.accounts.listing.unwrap();

    let listing_bump_seed = accounts::check_program_data_account(
        listing_account,
        program_id,
        vec![&ctx.accounts.base_token_mint.key.to_bytes(), b"Listing"],
    )
    .unwrap();

    // if this page name has been used, cancel
    if **listing_account.try_borrow_lamports()? > 0 {
        msg!("This listing already exists");
        return Ok(());
    }

    let mut program_data = state::ProgramData::try_from_slice(&ctx.accounts.cook_data.data.borrow()[..])?;

    program_data.num_launches += 1;

    program_data.serialize(&mut &mut ctx.accounts.cook_data.data.borrow_mut()[..])?;

    let mut unverified = Listing::try_from_slice(&ctx.accounts.unverified.data.borrow()[..])?;

    unverified.id = program_data.num_launches;
    unverified.account_type = state::AccountType::Listing;

    let listing_len = to_vec(&unverified).unwrap().len();

    // create the listing account
    utils::create_program_account(
        ctx.accounts.user,
        listing_account,
        program_id,
        listing_bump_seed,
        listing_len,
        vec![&ctx.accounts.base_token_mint.key.to_bytes(), b"Listing"],
    )?;

    unverified.serialize(&mut &mut listing_account.data.borrow_mut()[..])?;

    // give the creator some sauce
    let mut creator_data = state::UserData::try_from_slice(&ctx.accounts.creator_data.data.borrow()[..])?;
    creator_data.total_points += 25;
    creator_data.serialize(&mut &mut ctx.accounts.creator_data.data.borrow_mut()[..])?;

    // check if we should make the amm
    if ctx.accounts.amm.is_some() {
        msg!("have AMM");
        let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
        amm::get_amm_seeds(*ctx.accounts.base_token_mint.key, *ctx.accounts.quote_mint.key, &mut amm_seed_keys);

        let provider_bytes: &[u8] = if args.provider == 1 { b"RaydiumCPMM" } else { b"Raydium" };
        let amm_bump_seed = accounts::check_program_data_account(
            ctx.accounts.amm.unwrap(),
            program_id,
            vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), provider_bytes],
        )
        .unwrap();

        amm::create_amm(
            ctx.accounts.user,
            ctx.accounts.amm_pool.unwrap(),
            ctx.accounts.amm.unwrap(),
            ctx.accounts.amm_quote,
            ctx.accounts.quote_mint,
            ctx.accounts.amm_base,
            ctx.accounts.base_token_mint,
            ctx.accounts.lp_token_mint,
            ctx.accounts.amm_base,
            ctx.accounts.amm_base,
            program_id,
            amm_bump_seed,
            25,
            args.provider,
            0,
            ctx.accounts.amm_base,
            0,
            false,
        )?;

        // set start time
        let clock = Clock::get()?;
        let mut amm_data = AMM::try_from_slice(&ctx.accounts.amm.unwrap().data.borrow()[..])?;
        amm_data.start_time = clock.unix_timestamp as u64;
        amm_data.serialize(&mut &mut ctx.accounts.amm.unwrap().data.borrow_mut()[..])?;
    }

    let account_lamports = **ctx.accounts.unverified.try_borrow_lamports()?;
    **ctx.accounts.unverified.try_borrow_mut_lamports()? -= account_lamports;
    **ctx.accounts.user.try_borrow_mut_lamports()? += account_lamports;

    Ok(())
}
