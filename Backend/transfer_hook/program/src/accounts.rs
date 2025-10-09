use solana_program::declare_id;
use solana_program::pubkey::Pubkey;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
};

use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token_2022;

pub mod daoplays_account {
    use super::*;
    declare_id!("FxVpjJ5AGY6cfCwZQP5v8QBfS4J2NPa62HbGh1Fu2LpD");
}

pub mod lets_cook_pda {
    use super::*;
    declare_id!("Cook4kWjNd33iXUys8GZRcFNDuwm2ZRqPKU2qBrrQ7pB");
}
pub mod lets_cook_program {
    use super::*;
    declare_id!("9oQVwjBf5HQuRJFEv8yrLqoGYsR2jUDRUSHmDawpAdap");
}

pub mod wrapped_sol_mint_account {
    use super::*;
    declare_id!("So11111111111111111111111111111111111111112");
}

pub fn check_system_program_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &solana_program::system_program::ID {
        msg!(
            "expected system program {}",
            solana_program::system_program::ID
        );
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub fn check_token_program_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &spl_token::id() {
        msg!("expected token program {}", spl_token::id());
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub fn check_token_program_2022_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &spl_token_2022::id() {
        msg!("expected token 2022 program {}", spl_token_2022::id());
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub fn check_associated_token_program_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &spl_associated_token_account::ID {
        msg!(
            "expected associated token program {}",
            spl_associated_token_account::ID
        );
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub fn check_program_data_account<'a>(
    account_info: &'a AccountInfo<'a>,
    program_id: &Pubkey,
    seed: Vec<&[u8]>,
) -> Result<u8, ProgramError> {
    if seed.len() == 1 {
        let (expected_data_account, bump_seed) =
            Pubkey::find_program_address(&[seed[0]], &program_id);

        // the third account is the user's token account
        if account_info.key != &expected_data_account {
            msg!("expected program data account {}", expected_data_account);
            return Err(ProgramError::InvalidAccountData);
        }

        return Ok(bump_seed);
    }

    if seed.len() == 2 {
        let (expected_data_account, bump_seed) =
            Pubkey::find_program_address(&[seed[0], seed[1]], &program_id);

        // the third account is the user's token account
        if account_info.key != &expected_data_account {
            msg!("expected program data account {}", expected_data_account);
            return Err(ProgramError::InvalidAccountData);
        }

        return Ok(bump_seed);
    }

    let (expected_data_account, bump_seed) =
        Pubkey::find_program_address(&[seed[0], seed[1], seed[2]], &program_id);

    // the third account is the user's token account
    if account_info.key != &expected_data_account {
        msg!("expected program data account {}", expected_data_account);
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(bump_seed);
}

pub fn check_token_2022_account<'a>(
    account_info: Pubkey,
    mint_account_info: Pubkey,
    token_account_info: Pubkey,
) -> ProgramResult {
    let expected_token_account = get_associated_token_address_with_program_id(
        &account_info,
        &mint_account_info,
        &spl_token_2022::id(),
    );
    // the third account is the user's token account
    if token_account_info != expected_token_account {
        msg!(
            "expected token account {} for mint {} and account {}, recieved {}",
            expected_token_account,
            mint_account_info,
            account_info,
            token_account_info
        );
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}
