use borsh::{BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    accounts,
    instruction::accounts::RemoveListingAccounts,
    state::{Listing, Summary},
};

pub fn remove_listing<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    msg!("In Remove Listing");
    let ctx: crate::instruction::accounts::Context<RemoveListingAccounts> =
        RemoveListingAccounts::context(accounts)?;

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if !ctx.accounts.cook.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let _listing_bump_seed = accounts::check_program_data_account(
        ctx.accounts.listing,
        program_id,
        vec![&ctx.accounts.asset.key.to_bytes(), b"Listing"],
    )
    .unwrap();

    let _summary_bump_seed = accounts::check_program_data_account(
        ctx.accounts.summary,
        program_id,
        vec![&ctx.accounts.collection.key.to_bytes(), b"Summary"],
    )
    .unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    if **ctx.accounts.listing.try_borrow_lamports()? == 0 {
        msg!("Listing does not exist");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut summary = Summary::try_from_slice(&ctx.accounts.summary.data.borrow())?;
    if summary.num_listings > 0 {
        summary.num_listings -= 1;
    }
    summary.serialize(&mut &mut ctx.accounts.summary.data.borrow_mut()[..])?;

    // Deserialize listing to check seller
    let listing = Listing::try_from_slice(&ctx.accounts.listing.data.borrow())?;

    // Verify seller
    if listing.seller != *ctx.accounts.seller.key {
        msg!("Seller does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    if listing.asset != *ctx.accounts.asset.key {
        msg!("Asset does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    if listing.collection != *ctx.accounts.collection.key {
        msg!("Collection does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    // Transfer rent back to recipient
    let lamports = ctx.accounts.listing.lamports();
    **ctx.accounts.listing.lamports.borrow_mut() = 0;
    **ctx.accounts.seller.lamports.borrow_mut() += lamports;

    msg!("listing removed");

    Ok(())
}
