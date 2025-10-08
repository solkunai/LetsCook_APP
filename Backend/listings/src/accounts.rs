use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError};
use solana_program::{declare_id, pubkey::Pubkey};

pub const SOL_SEED: u32 = 59957379;

pub mod daoplays_account {
    use super::*;
    declare_id!("FxVpjJ5AGY6cfCwZQP5v8QBfS4J2NPa62HbGh1Fu2LpD");
}

pub mod core_account {
    use super::*;
    declare_id!("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
}

//////////// helper functions for checking accounts ////////////////

pub fn check_core_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &core_account::ID {
        msg!("expected core {} {}", core_account::ID, account_info.key);
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub fn check_system_program_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &solana_program::system_program::ID {
        msg!("expected system program {}", solana_program::system_program::ID);
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub fn check_program_data_account<'a>(account_info: &'a AccountInfo<'a>, program_id: &Pubkey, seed: Vec<&[u8]>) -> Result<u8, ProgramError> {
    if seed.len() == 1 {
        let (expected_data_account, bump_seed) = Pubkey::find_program_address(&[seed[0]], &program_id);

        // the third account is the user's token account
        if account_info.key != &expected_data_account {
            msg!("expected program data account {}", expected_data_account);
            return Err(ProgramError::InvalidAccountData);
        }

        return Ok(bump_seed);
    }

    if seed.len() == 2 {
        let (expected_data_account, bump_seed) = Pubkey::find_program_address(&[seed[0], seed[1]], &program_id);

        // the third account is the user's token account
        if account_info.key != &expected_data_account {
            msg!("expected program data account {}", expected_data_account);
            return Err(ProgramError::InvalidAccountData);
        }

        return Ok(bump_seed);
    }

    let (expected_data_account, bump_seed) = Pubkey::find_program_address(&[seed[0], seed[1], seed[2]], &program_id);

    // the third account is the user's token account
    if account_info.key != &expected_data_account {
        msg!("expected program data account {}", expected_data_account);
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(bump_seed);
}
