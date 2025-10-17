use borsh::{to_vec, BorshSerialize};
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey};
use spl_token_2022::extension::StateWithExtensions;

use crate::{
    accounts,
    instruction::{accounts::CreateUnverifiedListingAccounts, CreateUnverifiedListingArgs},
    launch::Listing,
    state::{self, Socials},
    utils::{self},
};
pub fn create_unverified_listing<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    args: CreateUnverifiedListingArgs,
) -> ProgramResult {
    msg!("in create game, getting accounts");

    let ctx: crate::instruction::accounts::Context<CreateUnverifiedListingAccounts> = CreateUnverifiedListingAccounts::context(accounts)?;

    msg!("verify accounts");

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let listing_bump_seed = accounts::check_program_data_account(
        ctx.accounts.listing,
        program_id,
        vec![
            &ctx.accounts.base_token_mint.key.to_bytes(),
            &ctx.accounts.user.key.to_bytes(),
            b"UnverifiedListing",
        ],
    )
    .unwrap();

    let _pda_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_data, program_id, vec![&accounts::DATA_SEED.to_le_bytes()]).unwrap();

    let _pda_sol_bump_seed =
        accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    // Handle any other checks

    // if this page name has been used, cancel
    if **ctx.accounts.listing.try_borrow_lamports()? > 0 {
        msg!("This listing already exists");
        return Ok(());
    }

    utils::create_user_data(ctx.accounts.user, ctx.accounts.user_data, program_id)?;

    let base_mint_data = ctx.accounts.base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;

    let mut listing = Listing {
        account_type: state::AccountType::UnverifiedListing,
        id: 0,
        mint: *ctx.accounts.base_token_mint.key,
        name: args.name,
        symbol: args.symbol,
        decimals: base_mint.base.decimals,
        icon_url: args.icon,
        meta_url: args.uri,
        banner_url: args.banner,
        description: args.description,
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
        vec![
            &ctx.accounts.base_token_mint.key.to_bytes(),
            &ctx.accounts.user.key.to_bytes(),
            b"UnverifiedListing",
        ],
    )?;

    listing.serialize(&mut &mut ctx.accounts.listing.data.borrow_mut()[..])?;

    Ok(())
}
