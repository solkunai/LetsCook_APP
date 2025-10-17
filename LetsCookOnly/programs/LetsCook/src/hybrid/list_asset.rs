use ::borsh::{to_vec, BorshDeserialize, BorshSerialize};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::invoke_signed,
    instruction::{Instruction, AccountMeta},
};
use mpl_core::instructions::TransferV1CpiBuilder;

use crate::accounts;
use crate::hybrid::{CollectionData, CollectionKeys};
use crate::instruction::accounts::ListNFTAccounts;
use crate::instruction::ListNFTArgs;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct ListIdx {
    pub idx: u8,
    pub price: u64,
}

pub fn list_asset<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: ListNFTArgs) -> ProgramResult {
    msg!("In List Asset");
    let ctx: crate::instruction::accounts::Context<ListNFTAccounts> = ListNFTAccounts::context(accounts)?;

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    {
        msg!("transferring asset");
        let _transfer = TransferV1CpiBuilder::new(ctx.accounts.core_program)
            .asset(ctx.accounts.asset)
            .authority(Some(ctx.accounts.user))
            .payer(ctx.accounts.user)
            .new_owner(ctx.accounts.cook_pda)
            .collection(Some(ctx.accounts.collection))
            .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]])?;
    }

    {
        msg!("get collection");
        let collection_data = CollectionData::try_from_slice(&ctx.accounts.collection_data.data.borrow()[..])?;

        let _collection_bump_seed = accounts::check_program_data_account(
            ctx.accounts.collection_data,
            program_id,
            vec![collection_data.page_name.as_bytes(), b"Collection"],
        )
        .unwrap();

        accounts::check_core_key(ctx.accounts.core_program)?;
        accounts::check_system_program_key(ctx.accounts.system_program)?;

        if *ctx.accounts.collection.key != collection_data.keys[CollectionKeys::CollectionAddress as usize] {
            msg!("collection does not match");
            return Err(ProgramError::InvalidAccountData);
        }

        let instruction_data = ListIdx { idx: 0, price: args.price };

        invoke_signed(
            &Instruction {
                program_id: *ctx.accounts.listing_program.key,
                accounts: vec![
                    AccountMeta::new(*ctx.accounts.cook_pda.key, true),
                    AccountMeta::new(*ctx.accounts.user.key, true),
                    AccountMeta::new_readonly(*ctx.accounts.asset.key, false),
                    AccountMeta::new_readonly(*ctx.accounts.collection.key, false),
                    AccountMeta::new(*ctx.accounts.listing.key, false),
                    AccountMeta::new(*ctx.accounts.listing_summary.key, false),
                    AccountMeta::new_readonly(*ctx.accounts.system_program.key, false),
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
    }

    msg!("listing complete");

    Ok(())
}
