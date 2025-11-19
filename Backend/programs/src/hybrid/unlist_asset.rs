use borsh::{to_vec, BorshDeserialize, BorshSerialize};

use mpl_core::instructions::TransferV1CpiBuilder;
use solana_program::program::invoke_signed;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey};

use crate::accounts;
use crate::utils::mpl_compat::convert_mpl_error;
use crate::hybrid::{find_plugin, CollectionData, CollectionPlugin, CollectionPluginType};
use crate::instruction::accounts::UnlistNFTAccounts;
use crate::instruction::UnlistNFTArgs;

use super::{CollectionKeys, NewListing};

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct UnlistIdx {
    pub idx: u8,
}

pub fn unlist_asset<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: UnlistNFTArgs) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<UnlistNFTAccounts> = UnlistNFTAccounts::context(accounts)?;

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let mut collection_data = Box::<CollectionData>::try_from_slice(&ctx.accounts.collection_data.data.borrow()[..])?;

    let _collection_bump_seed = accounts::check_program_data_account(
        ctx.accounts.collection_data,
        program_id,
        vec![collection_data.page_name.as_bytes(), b"Collection"],
    )
    .unwrap();

    accounts::check_core_key(ctx.accounts.core_program)?;
    accounts::check_system_program_key(ctx.accounts.system_program)?;

    unsafe {
        let _transfer = TransferV1CpiBuilder::new(unsafe { std::mem::transmute(ctx.accounts.core_program) })
            .asset(unsafe { std::mem::transmute(ctx.accounts.asset) })
            .authority(Some(unsafe { std::mem::transmute(ctx.accounts.cook_pda) }))
            .payer(unsafe { std::mem::transmute(ctx.accounts.user) })
            .new_owner(unsafe { std::mem::transmute(ctx.accounts.user) })
            .collection(Some(unsafe { std::mem::transmute(ctx.accounts.collection) }))
            .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]])
            .map_err(|e| convert_mpl_error(e))?;
    }

    if **ctx.accounts.listing.try_borrow_lamports()? != 0 {
        let listing = NewListing::try_from_slice(&ctx.accounts.listing.data.borrow())?;

        // Validate the listing
        if listing.asset != *ctx.accounts.asset.key {
            msg!("asset does not match listing");
            return Err(ProgramError::InvalidAccountData);
        }
        if listing.seller != *ctx.accounts.user.key {
            msg!("seller does not match listing");
            return Err(ProgramError::InvalidAccountData);
        }
        if listing.collection != *ctx.accounts.collection.key {
            msg!("collection does not match listing");
            return Err(ProgramError::InvalidAccountData);
        }
        if listing.collection != collection_data.keys[CollectionKeys::CollectionAddress as usize] {
            msg!("collection does not match listing");
            return Err(ProgramError::InvalidAccountData);
        }

        let instruction_data = UnlistIdx { idx: 1 };

        invoke_signed(
            &solana_program::instruction::Instruction {
                program_id: *ctx.accounts.listing_program.key,
                accounts: vec![
                    solana_program::instruction::AccountMeta::new(*ctx.accounts.cook_pda.key, true),
                    solana_program::instruction::AccountMeta::new(*ctx.accounts.user.key, true),
                    solana_program::instruction::AccountMeta::new(*ctx.accounts.user.key, true),
                    solana_program::instruction::AccountMeta::new_readonly(*ctx.accounts.asset.key, false),
                    solana_program::instruction::AccountMeta::new_readonly(*ctx.accounts.collection.key, false),
                    solana_program::instruction::AccountMeta::new(*ctx.accounts.listing.key, false),
                    solana_program::instruction::AccountMeta::new(*ctx.accounts.listing_summary.key, false),
                    solana_program::instruction::AccountMeta::new_readonly(*ctx.accounts.system_program.key, false),
                ],
                data: to_vec(&instruction_data).unwrap(),
            },
            &[
                ctx.accounts.cook_pda.clone(),
                ctx.accounts.user.clone(),
                ctx.accounts.asset.clone(),
                ctx.accounts.collection.clone(),
                ctx.accounts.listing.clone(),
                ctx.accounts.listing_summary.clone(),
                ctx.accounts.system_program.clone(),
            ],
            &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]],
        )?;
        return Ok(());
    }

    let plugin_option = find_plugin(&collection_data.plugins, CollectionPluginType::Marketplace);

    if !plugin_option.is_some() {
        msg!("collection has no marketplace");
        return Err(ProgramError::InvalidAccountData);
    }

    /*
    let marketplace_option = match plugin_option.unwrap() {
        CollectionPlugin::Marketplace(args) => Some(args),
        _ => None,
    };

    if marketplace_option.is_none() {
        msg!("marketplace is none");
        return Err(ProgramError::InvalidAccountData);
    }
    */
    // Update existing marketplace in place
    if let Some(CollectionPlugin::Marketplace(marketplace)) =
        collection_data.plugins.iter_mut().find(|p| matches!(p, CollectionPlugin::Marketplace(_)))
    {
        let index = args.index as usize;

        if index >= marketplace.listings.len() {
            return Err(ProgramError::InvalidAccountData);
        }

        // Validate the listing
        if marketplace.listings[index].asset != *ctx.accounts.asset.key {
            msg!("asset does not match listing");
            return Err(ProgramError::InvalidAccountData);
        }
        if marketplace.listings[index].seller != *ctx.accounts.user.key {
            msg!("seller does not match listing");
            return Err(ProgramError::InvalidAccountData);
        }

        // Remove the listing in place
        marketplace.listings.remove(index);
    } else {
        msg!("failed to get marketplace plugin");
        return Err(ProgramError::InvalidAccountData);
    }
    /*
        let mut marketplace = marketplace_option.unwrap().clone();

        let index = args.index as usize;
        let mut listings = marketplace.listings.clone();
        if listings[index].asset != *ctx.accounts.asset.key {
            msg!("asset does not match listing");
            return Err(ProgramError::InvalidAccountData);
        }
        if listings[index].seller != *ctx.accounts.user.key {
            msg!("seller does not match listing");
            return Err(ProgramError::InvalidAccountData);
        }

        listings.remove(index);
        marketplace.listings = listings;

        if let Some(plugin) = collection_data.plugins.iter_mut().find(|p| matches!(p, CollectionPlugin::Marketplace(_))) {
            *plugin = CollectionPlugin::Marketplace(marketplace);
        }
    */
    // reduce the size of the collection data
    ctx.accounts.collection_data.realloc(to_vec(&collection_data).unwrap().len(), false)?;
    collection_data.serialize(&mut &mut ctx.accounts.collection_data.data.borrow_mut()[..])?;

    Ok(())
}
