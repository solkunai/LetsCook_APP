use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey};

use crate::{
    accounts,
    instruction::{accounts::CreateUnverifiedListingAccounts, CreateUnverifiedListingArgs},
    launch::Listing,
    state::Socials,
    utils::{self},
};
pub fn edit_listing<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: CreateUnverifiedListingArgs) -> ProgramResult {
    msg!("in create game, getting accounts");

    let ctx: crate::instruction::accounts::Context<CreateUnverifiedListingAccounts> = CreateUnverifiedListingAccounts::context(accounts)?;

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

    let _pda_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_data, program_id, vec![&accounts::DATA_SEED.to_le_bytes()]).unwrap();

    let _pda_sol_bump_seed =
        accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    // Handle any other checks

    // if this page name has been used, cancel
    if **ctx.accounts.listing.try_borrow_lamports()? == 0 {
        msg!("This listing does not exist");
        return Ok(());
    }

    if *ctx.accounts.user.key != accounts::daoplays_account::ID {
        return Err(ProgramError::InvalidAccountData);
    }

    let mut listing = Listing::try_from_slice(&ctx.accounts.listing.data.borrow()[..])?;

    listing.socials[Socials::Website as usize] = args.website;
    listing.socials[Socials::Twitter as usize] = args.twitter;
    listing.socials[Socials::Telegram as usize] = args.telegram;
    listing.socials[Socials::Discord as usize] = args.discord;

    let listing_len = to_vec(&listing).unwrap().len();

    // create the listing account

    utils::check_for_realloc(ctx.accounts.listing, ctx.accounts.user, ctx.accounts.listing.data_len(), listing_len)?;

    listing.serialize(&mut &mut ctx.accounts.listing.data.borrow_mut()[..])?;

    Ok(())
}
