use borsh::{to_vec, BorshDeserialize, BorshSerialize};

use crate::hybrid::CollectionData;
use crate::instruction::accounts::InitAccounts;
use crate::instruction::{SetNameArgs, VoteArgs};
use crate::{accounts, launch};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
};

use crate::state;
use crate::utils::{self, calculate_rent};

pub fn init<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<InitAccounts> = InitAccounts::context(accounts)?;

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let data_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_data, program_id, vec![&accounts::DATA_SEED.to_le_bytes()]).unwrap();

    let sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    // create the account if required
    utils::create_program_account(
        ctx.accounts.user,
        ctx.accounts.cook_data,
        program_id,
        data_bump_seed,
        state::get_arena_data_size(),
        vec![&accounts::DATA_SEED.to_le_bytes()],
    )?;

    // create the account if required
    utils::create_program_account(
        ctx.accounts.user,
        ctx.accounts.cook_pda,
        ctx.accounts.system_program.key,
        sol_bump_seed,
        0,
        vec![&accounts::SOL_SEED.to_le_bytes()],
    )?;

    let mut program_data = state::ProgramData::try_from_slice(&ctx.accounts.cook_data.data.borrow()[..])?;

    program_data.account_type = state::AccountType::Program;
    program_data.serialize(&mut &mut ctx.accounts.cook_data.data.borrow_mut()[..])?;

    Ok(())
}

pub fn hype_vote<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: VoteArgs) -> ProgramResult {
    msg!("in hype vote, getting accounts");

    let account_info_iter = &mut accounts.iter();

    // This function expects to be passed three accounts, get them all first and then check their value is as expected
    let user_account_info = next_account_info(account_info_iter)?;
    let user_data_account_info = next_account_info(account_info_iter)?;
    let launch_data_account_info = next_account_info(account_info_iter)?;
    let system_program_account_info = next_account_info(account_info_iter)?;

    if !user_account_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut launch_id: u64 = 0;
    if args.launch_type == 0 {
        let mut listing: launch::Listing = launch::Listing::try_from_slice(&launch_data_account_info.data.borrow()[..])?;

        let _listing_bump_seed =
            accounts::check_program_data_account(launch_data_account_info, program_id, vec![&listing.mint.to_bytes(), b"Listing"]).unwrap();

        if args.vote == 1 {
            listing.positive_votes += 1;
        } else if args.vote == 2 {
            listing.negative_votes += 1
        } else {
            msg!("invalid vote value");
            return Err(ProgramError::InvalidAccountData);
        }

        launch_id = listing.id;

        listing.serialize(&mut &mut launch_data_account_info.data.borrow_mut()[..])?;
    }

    if args.launch_type == 1 {
        let mut launch_data: CollectionData = CollectionData::try_from_slice(&launch_data_account_info.data.borrow()[..])?;

        let _launch_bump_seed = accounts::check_program_data_account(
            launch_data_account_info,
            program_id,
            vec![launch_data.page_name.as_bytes(), b"Collection"],
        )
        .unwrap();

        if args.vote == 1 {
            launch_data.positive_votes += 1;
        } else if args.vote == 2 {
            launch_data.negative_votes += 1
        } else {
            msg!("invalid vote value");
            return Err(ProgramError::InvalidAccountData);
        }

        launch_id = launch_data.launch_id;

        launch_data.serialize(&mut &mut launch_data_account_info.data.borrow_mut()[..])?;
    }

    accounts::check_system_program_key(system_program_account_info)?;

    utils::create_user_data(user_account_info, user_data_account_info, program_id)?;

    let mut user_data = state::UserData::try_from_slice(&user_data_account_info.data.borrow()[..])?;

    user_data.total_points += 1;

    let old_len = to_vec(&user_data).unwrap().len();

    msg!("vector before: {:?}", user_data.votes);
    let current_length = user_data.votes.len();
    match user_data.votes.binary_search(&launch_id) {
        Ok(_pos) => {} // element already in vector @ `pos`
        Err(pos) => user_data.votes.insert(pos, launch_id),
    }
    msg!("vector after: {:?}", user_data.votes);

    if current_length == user_data.votes.len() {
        msg!("can only vote once");
        return Err(ProgramError::InvalidAccountData);
    }

    let new_len = to_vec(&user_data).unwrap().len();

    let old_lamports = calculate_rent(old_len as u64);
    let new_lamports = calculate_rent(new_len as u64);

    msg!(
        "update player account to new size: {} current_balance: {} new_balance {}",
        new_len,
        old_lamports,
        new_lamports
    );

    invoke(
        &system_instruction::transfer(user_account_info.key, user_data_account_info.key, new_lamports - old_lamports),
        &[user_account_info.clone(), user_data_account_info.clone()],
    )?;

    user_data_account_info.realloc(new_len, true)?;

    user_data.serialize(&mut &mut user_data_account_info.data.borrow_mut()[..])?;

    Ok(())
}

pub fn set_name<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: SetNameArgs) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    // This function expects to be passed three accounts, get them all first and then check their value is as expected
    let user_account_info = next_account_info(account_info_iter)?;
    let user_data_account_info = next_account_info(account_info_iter)?;
    let system_program_account_info = next_account_info(account_info_iter)?;

    msg!("set user name");

    if !user_account_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut user_data = state::UserData::try_from_slice(&user_data_account_info.data.borrow()[..])?;

    let _user_data_bump =
        accounts::check_program_data_account(user_data_account_info, program_id, vec![&user_account_info.key.to_bytes(), b"User"]).unwrap();

    // the third and final account is the system_program
    accounts::check_system_program_key(system_program_account_info)?;

    // Handle other checks

    if *user_account_info.key != user_data.user_key {
        msg!("Only user can edit their data");
        return Err(ProgramError::InvalidAccountData);
    }

    if args.name == "" {
        msg!("cannt set name to blank");
        return Err(ProgramError::InvalidAccountData);
    }

    let old_len = to_vec(&user_data).unwrap().len();

    if user_data.user_name == "" {
        user_data.total_points += 1;
    }

    user_data.user_name = args.name.to_string();

    let new_len = to_vec(&user_data).unwrap().len();

    let old_lamports = calculate_rent(old_len as u64);
    let new_lamports = calculate_rent(new_len as u64);

    if new_lamports > old_lamports {
        msg!(
            "update user account to new size: {} current_balance: {} new_balance {}",
            new_len,
            old_lamports,
            new_lamports
        );

        invoke(
            &system_instruction::transfer(user_account_info.key, user_data_account_info.key, new_lamports - old_lamports),
            &[user_account_info.clone(), user_data_account_info.clone()],
        )?;
    }

    user_data_account_info.realloc(new_len, true)?;

    user_data.serialize(&mut &mut user_data_account_info.data.borrow_mut()[..])?;

    Ok(())
}

pub fn close_account<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    msg!("in close account");
    // This function expects to be passed three accounts, get them all first and then check their value is as expected
    let user_account_info = next_account_info(account_info_iter)?;
    let cook_pda = next_account_info(account_info_iter)?;
    let system_program_account_info = next_account_info(account_info_iter)?;

    if !user_account_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if *user_account_info.key != accounts::daoplays_account::ID {
        return Err(ProgramError::InvalidAccountData);
    }

    let _pda_sol_bump_seed = accounts::check_program_data_account(cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    accounts::check_system_program_key(system_program_account_info)?;

    loop {
        let next_account = account_info_iter.next();
        if next_account.is_none() {
            break;
        }
        let account = next_account.unwrap();

        /*
        invoke_signed(
            &system_instruction::transfer(cook_pda.key, account.key, 10000),
            &[cook_pda.clone(), account.clone()],
            &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]],
        )?;

        return Ok(());
        */

        let account_lamports = **account.try_borrow_lamports()?;

        msg!("transferring lamports");
        **account.try_borrow_mut_lamports()? -= account_lamports;
        **user_account_info.try_borrow_mut_lamports()? += account_lamports;
    }

    Ok(())
}
