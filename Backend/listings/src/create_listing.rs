use borsh::{to_vec, BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    accounts,
    instruction::{accounts::CreateListingAccounts, ListNFTArgs},
    state::{Listing, Summary},
    utils,
};

pub fn create_listing<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    args: ListNFTArgs,
) -> ProgramResult {
    msg!("In Create Listing");
    let ctx: crate::instruction::accounts::Context<CreateListingAccounts> =
        CreateListingAccounts::context(accounts)?;

    if !ctx.accounts.seller.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if !ctx.accounts.cook.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let listing_bump_seed = accounts::check_program_data_account(
        ctx.accounts.listing,
        program_id,
        vec![&ctx.accounts.asset.key.to_bytes(), b"Listing"],
    )
    .unwrap();

    let summary_bump_seed = accounts::check_program_data_account(
        ctx.accounts.summary,
        program_id,
        vec![&ctx.accounts.collection.key.to_bytes(), b"Summary"],
    )
    .unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    if **ctx.accounts.summary.try_borrow_lamports()? == 0 {
        let summary: Summary = Summary { num_listings: 0 };

        let summary_len = to_vec(&summary).unwrap().len();

        utils::create_program_account(
            ctx.accounts.seller,
            ctx.accounts.summary,
            program_id,
            summary_bump_seed,
            summary_len,
            vec![&ctx.accounts.collection.key.to_bytes(), b"Summary"],
        )?;
    }

    if **ctx.accounts.listing.try_borrow_lamports()? != 0 {
        msg!("Listing already exists");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let mut summary = Summary::try_from_slice(&ctx.accounts.summary.data.borrow())?;
    summary.num_listings += 1;
    summary.serialize(&mut &mut ctx.accounts.summary.data.borrow_mut()[..])?;

    msg!("create listing {}", summary.num_listings);

    let listing: Listing = Listing {
        collection: *ctx.accounts.collection.key,
        asset: *ctx.accounts.asset.key,
        seller: *ctx.accounts.seller.key,
        price: args.price,
    };

    let listing_len = to_vec(&listing).unwrap().len();

    utils::create_program_account(
        ctx.accounts.seller,
        ctx.accounts.listing,
        program_id,
        listing_bump_seed,
        listing_len,
        vec![&ctx.accounts.asset.key.to_bytes(), b"Listing"],
    )?;

    listing.serialize(&mut &mut ctx.accounts.listing.data.borrow_mut()[..])?;

    msg!("listing complete");

    Ok(())
}
