use borsh::{to_vec, BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program::invoke, program_error::ProgramError, pubkey::Pubkey, system_instruction,
};

use crate::hybrid::CollectionData;
use crate::instruction::EditCollectionArgs;
use crate::{accounts, instruction::accounts::EditCollectionAccounts, launch};

use crate::state;
use crate::utils::{self, calculate_rent};

pub fn edit_collection<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: EditCollectionArgs) -> ProgramResult {
    msg!("in edit collection, getting accounts");

    let ctx: crate::instruction::accounts::Context<EditCollectionAccounts> = EditCollectionAccounts::context(accounts)?;

    msg!("verify accounts");

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut collection_data = Box::<CollectionData>::try_from_slice(&ctx.accounts.collection_data.data.borrow()[..])?;

    if collection_data.description != "" {
        msg!("Collection launched, can no longer edit");
        return Err(ProgramError::InvalidAccountData);
    }

    let _launch_bump_seed = accounts::check_program_data_account(
        ctx.accounts.collection_data,
        program_id,
        vec![collection_data.page_name.as_bytes(), b"Collection"],
    )
    .unwrap();

    let _pda_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_data, program_id, vec![&accounts::DATA_SEED.to_le_bytes()]).unwrap();

    let _is_2022 = accounts::check_token_program_key(ctx.accounts.token_program)?;
    accounts::check_associated_token_program_key(ctx.accounts.associated_token)?;
    accounts::check_system_program_key(ctx.accounts.system_program)?;

    // create any token accounts required
    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.team,
        ctx.accounts.token_mint,
        ctx.accounts.team_token,
        ctx.accounts.token_program,
    )?;

    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.cook_pda,
        ctx.accounts.token_mint,
        ctx.accounts.cook_token,
        ctx.accounts.token_program,
    )?;

    utils::create_user_data(ctx.accounts.user, ctx.accounts.user_data, program_id)?;

    let mut user_data = state::UserData::try_from_slice(&ctx.accounts.user_data.data.borrow()[..])?;

    user_data.total_points += 100;

    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    // Handle other checks

    if *ctx.accounts.user.key != collection_data.keys[launch::LaunchKeys::Seller as usize] {
        msg!("Only launch creator can edit launch");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut program_data = state::ProgramData::try_from_slice(&ctx.accounts.cook_data.data.borrow()[..])?;

    program_data.num_launches += 1;

    program_data.serialize(&mut &mut ctx.accounts.cook_data.data.borrow_mut()[..])?;

    let old_len = ctx.accounts.collection_data.data_len(); //Box::new(to_vec(&collection_data).unwrap()).len();

    msg!("old len {}", old_len);

    collection_data.launch_id = program_data.num_launches;

    collection_data.description = args.description.to_string();

    collection_data.socials[state::Socials::Website as usize] = args.website;
    collection_data.socials[state::Socials::Twitter as usize] = args.twitter;
    collection_data.socials[state::Socials::Telegram as usize] = args.telegram;
    collection_data.socials[state::Socials::Discord as usize] = args.discord;

    let new_len = (&to_vec(&collection_data).unwrap()).len();
    msg!("new len {}", new_len);

    let old_lamports = calculate_rent(old_len as u64);
    let new_lamports = calculate_rent(new_len as u64);

    if new_lamports > old_lamports {
        msg!(
            "update launch account to new size: {} current_balance: {} new_balance {}",
            new_len,
            old_lamports,
            new_lamports
        );

        invoke(
            &system_instruction::transfer(ctx.accounts.user.key, ctx.accounts.collection_data.key, new_lamports - old_lamports),
            &[ctx.accounts.user.clone(), ctx.accounts.collection_data.clone()],
        )?;
    }

    ctx.accounts.collection_data.realloc(new_len, false)?;

    collection_data.serialize(&mut &mut ctx.accounts.collection_data.data.borrow_mut()[..])?;

    Ok(())
}
