use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::{
    accounts, amm,
    instruction::{accounts::EditLaunchAccounts, EditArgs},
    launch::{Distribution, LaunchData, LaunchFlags, LaunchKeys, Listing},
    state::Socials,
    utils,
};

pub fn edit_launch<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: EditArgs) -> ProgramResult {
    msg!("in edit launch, getting accounts");

    let ctx: crate::instruction::accounts::Context<EditLaunchAccounts> = EditLaunchAccounts::context(accounts)?;

    msg!("verify accounts");

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let _listing_bump_seed = accounts::check_program_data_account(
        ctx.accounts.listing,
        program_id,
        vec![&ctx.accounts.base_token_mint.key.to_bytes(), b"Listing"],
    )
    .unwrap();

    msg!("get listing data");
    let mut listing = Listing::try_from_slice(&ctx.accounts.listing.data.borrow()[..])?;
    msg!("get launch data");
    let mut launch_data = LaunchData::try_from_slice(&ctx.accounts.launch_data.data.borrow()[..])?;

    let _launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.launch_data, program_id, vec![launch_data.page_name.as_bytes(), b"Launch"]).unwrap();

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
    amm::get_amm_seeds(*ctx.accounts.base_token_mint.key, *ctx.accounts.quote_token_mint.key, &mut amm_seed_keys);

    let amm_provider_bytes: &[u8] = if launch_data.flags[LaunchFlags::AMMProvider as usize] == 0 {
        b"CookAMM"
    } else {
        b"RaydiumCPMM"
    };

    let amm_bump_seed = accounts::check_program_data_account(
        ctx.accounts.amm,
        program_id,
        vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), amm_provider_bytes],
    )
    .unwrap();

    accounts::check_wrapped_sol_key(ctx.accounts.quote_token_mint)?;

    if *ctx.accounts.base_token_mint.key != listing.mint {
        msg!("Token mint address mismatch");
        return Err(ProgramError::InvalidAccountData);
    }

    // if this is a cook AMM check they are the right accounts, otherwise just trust they are, it will fail later
    msg!("check amm accounts");
    if launch_data.flags[LaunchFlags::AMMProvider as usize] == 0 {
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
    }

    msg!("check token programs");
    let _quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;
    let _base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;

    // the third and final account is the system_program
    msg!("check system programs");
    accounts::check_system_program_key(ctx.accounts.system_program)?;
    accounts::check_associated_token_program_key(ctx.accounts.associated_token)?;

    let trade_to_earn_bump = accounts::check_program_data_account(
        ctx.accounts.trade_to_earn,
        program_id,
        vec![&ctx.accounts.amm.key.to_bytes(), b"TradeToEarn"],
    )
    .unwrap();

    msg!("create user data");
    utils::create_user_data(ctx.accounts.user, ctx.accounts.user_data, program_id)?;

    amm::create_amm(
        ctx.accounts.user,
        ctx.accounts.amm_pool,
        ctx.accounts.amm,
        ctx.accounts.amm_quote,
        ctx.accounts.quote_token_mint,
        ctx.accounts.amm_base,
        ctx.accounts.base_token_mint,
        ctx.accounts.lp_token_mint,
        ctx.accounts.quote_token_program,
        ctx.accounts.base_token_program,
        program_id,
        launch_data.flags[LaunchFlags::AMMProvider as usize],
        ctx.accounts.trade_to_earn,
        trade_to_earn_bump,
    )?;

    launch_data.flags[LaunchFlags::LPState as usize] = 1;

    // Handle other checks

    if *ctx.accounts.user.key != launch_data.keys[LaunchKeys::Seller as usize] {
        msg!("Only launch creator can edit launch");
        return Err(ProgramError::InvalidAccountData);
    }

    let dist_sum: u8 = args.distribution.iter().sum();
    if args.distribution[Distribution::Raffle as usize] == 0 || args.distribution[Distribution::LP as usize] == 0 || dist_sum != 100 {
        msg!("invalid distribution");
        return Err(ProgramError::InvalidAccountData);
    }

    if ((u64::pow(10, listing.decimals as u32) * launch_data.total_supply) as f64)
        * ((args.distribution[Distribution::Raffle as usize] as f64) / 100.0)
        < launch_data.num_mints as f64
    {
        msg!("Not enough tokens to support the raffle");
        return Err(ProgramError::InvalidAccountData);
    }

    let clock = Clock::get()?;
    let last_interaction = clock.unix_timestamp;

    // can only edit 48 hours before launch except for the initial init of data
    if listing.description != "" && last_interaction > (launch_data.launch_date / 1000 - 48 * 60 * 60) as i64 {
        msg!("Can only edit launch up to 48 hours before start");
        return Err(ProgramError::InvalidAccountData);
    }

    let old_listing_len = to_vec(&listing).unwrap().len();

    launch_data.num_interactions += 1;
    launch_data.last_interaction = last_interaction;

    listing.description = args.description.to_string();

    for i in 0..Distribution::LENGTH as usize {
        launch_data.distribution[i] = args.distribution[i];
    }

    listing.socials[Socials::Website as usize] = args.website;
    listing.socials[Socials::Twitter as usize] = args.twitter;
    listing.socials[Socials::Telegram as usize] = args.telegram;
    listing.socials[Socials::Discord as usize] = args.discord;

    let new_listing_len = to_vec(&listing).unwrap().len();

    utils::check_for_realloc(ctx.accounts.listing, ctx.accounts.user, old_listing_len, new_listing_len)?;

    listing.serialize(&mut &mut ctx.accounts.listing.data.borrow_mut()[..])?;
    launch_data.serialize(&mut &mut ctx.accounts.launch_data.data.borrow_mut()[..])?;

    Ok(())
}
