use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, native_token::LAMPORTS_PER_SOL, program_error::ProgramError, pubkey::Pubkey,
};
use spl_token_2022::extension::StateWithExtensions;

use crate::{
    accounts, amm,
    instruction::{accounts::CreateInstantLaunchAccounts, InstantLaunchArgs},
    launch::Listing,
    state::{self, Socials},
    utils::{self, create_2022_token},
};
pub fn instant_launch<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: InstantLaunchArgs) -> ProgramResult {
    msg!("in instant_launch");

    let ctx: crate::instruction::accounts::Context<CreateInstantLaunchAccounts> = CreateInstantLaunchAccounts::context(accounts)?;

    msg!("verify accounts");

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let listing_bump_seed = accounts::check_program_data_account(
        ctx.accounts.listing,
        program_id,
        vec![&ctx.accounts.base_token_mint.key.to_bytes(), b"Listing"],
    )
    .unwrap();

    accounts::check_wrapped_sol_key(ctx.accounts.quote_token_mint)?;

    let _pda_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_data, program_id, vec![&accounts::DATA_SEED.to_le_bytes()]).unwrap();

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let lp_bump_seed =
        accounts::check_program_data_account(ctx.accounts.lp_token_mint, program_id, vec![&ctx.accounts.amm.key.to_bytes(), b"LP"]).unwrap();

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
    amm::get_amm_seeds(*ctx.accounts.base_token_mint.key, *ctx.accounts.quote_token_mint.key, &mut amm_seed_keys);

    let amm_provider_bytes: &[u8] = b"CookAMM";

    let amm_bump_seed = accounts::check_program_data_account(
        ctx.accounts.amm,
        program_id,
        vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), amm_provider_bytes],
    )
    .unwrap();

    let num_price_accounts: u32 = 0;

    let price_data_bump_seed = accounts::check_program_data_account(
        ctx.accounts.price_data,
        program_id,
        vec![&ctx.accounts.amm.key.to_bytes(), &num_price_accounts.to_le_bytes(), b"TimeSeries"],
    )
    .unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;
    let _quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;
    let base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;
    accounts::check_associated_token_program_key(ctx.accounts.associated_token)?;

    let mut program_data = state::ProgramData::try_from_slice(&ctx.accounts.cook_data.data.borrow()[..])?;

    program_data.num_launches += 1;

    program_data.serialize(&mut &mut ctx.accounts.cook_data.data.borrow_mut()[..])?;

    let mut listing = Listing {
        account_type: state::AccountType::Listing,
        id: program_data.num_launches,
        mint: *ctx.accounts.base_token_mint.key,
        name: args.name,
        symbol: args.symbol,
        decimals: 6,
        icon_url: args.icon,
        meta_url: args.uri,
        banner_url: "".to_string(),
        description: args.description.to_string(),
        positive_votes: 0,
        negative_votes: 0,
        socials: Vec::with_capacity(state::Socials::LENGTH as usize),
    };
    listing.socials = vec!["".to_string(); state::Socials::LENGTH as usize];

    listing.description = args.description.to_string();

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

    let total_token_amount = 100000000 * u64::pow(10, listing.decimals as u32);

    let token_config = state::TokenDetails {
        name: listing.name.to_string(),
        symbol: listing.symbol.to_string(),
        uri: listing.meta_url.to_string(),
        pda: accounts::SOL_SEED,
        decimals: listing.decimals,
        total_supply: total_token_amount,
    };

    if base_2022 {
        // mint the token
        create_2022_token(
            ctx.accounts.user,
            ctx.accounts.cook_pda,
            ctx.accounts.base_token_program,
            pda_sol_bump_seed,
            ctx.accounts.base_token_mint,
            ctx.accounts.amm_base,
            ctx.accounts.amm,
            token_config,
            0,
            0,
            None,
            None,
        )
        .unwrap();
    } else {
        msg!("Only T22 supported");
        return Err(ProgramError::InvalidAccountData);
    }

    amm::create_amm(
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
        ctx.accounts.system_program,
        0,
        true,
    )?;

    let wsol_amount: u64 = if state::NETWORK == state::Network::Eclipse {
        LAMPORTS_PER_SOL / 2000
    } else {
        LAMPORTS_PER_SOL / 100
    };
    utils::wrap_sol(wsol_amount, ctx.accounts.user, ctx.accounts.amm_quote, ctx.accounts.quote_token_program)?;

    amm::init_cook_amm_data(
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

    let quote_mint_data = ctx.accounts.quote_token_mint.data.borrow();
    let quote_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&quote_mint_data)?;

    // finally create the LP token
    amm::create_lp_mint(
        ctx.accounts.user,
        ctx.accounts.amm,
        ctx.accounts.lp_token_mint,
        ctx.accounts.base_token_program,
        ctx.accounts.cook_pda,
        &quote_mint,
        lp_bump_seed,
        pda_sol_bump_seed,
    )?;

    utils::create_user_data(ctx.accounts.user, ctx.accounts.user_data, program_id)?;

    let mut user_data = state::UserData::try_from_slice(&ctx.accounts.user_data.data.borrow()[..])?;
    user_data.total_points += 200;
    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    Ok(())
}
