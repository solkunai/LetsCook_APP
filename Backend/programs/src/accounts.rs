use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError};
use solana_program::{declare_id, pubkey::Pubkey};

use crate::state;

use spl_associated_token_account::get_associated_token_address_with_program_id;

pub const SOL_SEED: u32 = 59957379;
pub const DATA_SEED: u32 = 7571427;

pub mod daoplays_account {
    use super::*;
    declare_id!("FxVpjJ5AGY6cfCwZQP5v8QBfS4J2NPa62HbGh1Fu2LpD");
}

pub mod admin2 {
    use super::*;
    declare_id!("7oAfRLy81EwMJAXNKbZFaMTayBFoBpkua4ukWiCZBZz5");
}

pub mod devnet_fees_account {
    use super::*;
    declare_id!("FxVpjJ5AGY6cfCwZQP5v8QBfS4J2NPa62HbGh1Fu2LpD");
}

pub mod prod_fees_account {
    use super::*;
    declare_id!("HtszJ5ntXnwUFc2anMzp5RgaPxtvTFojL2qb5kcFEytA");
}

pub mod listings_program {
    use super::*;
    declare_id!("288fPpF7XGk82Wth2XgyoF2A82YKryEyzL58txxt47kd");
}

pub fn get_expected_fees_key() -> Pubkey {
    if state::NETWORK == state::Network::Devnet {
        return devnet_fees_account::ID;
    }

    return prod_fees_account::ID;
}

pub fn check_fees_account<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &get_expected_fees_key() {
        msg!("expected fees key {} {}", get_expected_fees_key(), account_info.key);
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub mod wrapped_sol_mint_account {
    use super::*;
    declare_id!("So11111111111111111111111111111111111111112");
}

pub mod core_account {
    use super::*;
    declare_id!("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
}

pub mod open_book_market_dev {
    use super::*;
    declare_id!("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");
}

pub mod open_book_market_prod {
    use super::*;
    declare_id!("srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX");
}

pub mod jupiter {
    use super::*;
    declare_id!("jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu");
}

pub mod raydium_dev {
    use super::*;
    declare_id!("CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW");
}

pub mod raydium_prod {
    use super::*;
    declare_id!("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C");
}

pub mod orao_program {
    use super::*;
    declare_id!("VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y");
}

pub fn get_expected_raydium_key() -> Pubkey {
    if state::NETWORK == state::Network::Devnet {
        return raydium_dev::ID;
    }

    return raydium_prod::ID;
}

//////////// helper functions for checking accounts ////////////////

pub fn check_jupiter_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &jupiter::ID {
        msg!("expected jupiter {} {}", jupiter::ID, account_info.key);
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub fn check_orao_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &orao_program::ID {
        msg!("expected orao {} {}", orao_program::ID, account_info.key);
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub fn check_raydium_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &get_expected_raydium_key() {
        msg!("expected raydium {} {}", get_expected_raydium_key(), account_info.key);
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

pub fn check_core_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &core_account::ID {
        msg!("expected core {} {}", core_account::ID, account_info.key);
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}

// Metaplex removed - using Token-2022 metadata only

pub fn check_wrapped_sol_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &wrapped_sol_mint_account::ID {
        msg!("expected wrapped sol mint {} {}", wrapped_sol_mint_account::ID, account_info.key);
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

pub fn check_token_program_key<'a>(account_info: &'a AccountInfo<'a>) -> Result<bool, ProgramError> {
    if account_info.key == &spl_token_2022::id() {
        return Ok(true);
    }

    if account_info.key == &spl_token::id() {
        return Ok(false);
    }

    msg!(
        "expected token programs {} {} got {}",
        spl_token_2022::id(),
        spl_token::id(),
        account_info.key
    );
    return Err(ProgramError::InvalidAccountData);
}

pub fn check_associated_token_program_key<'a>(account_info: &'a AccountInfo<'a>) -> ProgramResult {
    if account_info.key != &spl_associated_token_account::ID {
        msg!(
            "expected associated token program {} {}",
            spl_associated_token_account::ID,
            account_info.key
        );
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

pub fn check_token_account<'a>(
    account_info: &'a AccountInfo<'a>,
    mint_account_info: &'a AccountInfo<'a>,
    token_account_info: &'a AccountInfo<'a>,
    token_program: &'a AccountInfo<'a>,
) -> ProgramResult {
    let expected_token_account = get_associated_token_address_with_program_id(&account_info.key, &mint_account_info.key, &token_program.key);
    // the third account is the user's token account
    if token_account_info.key != &expected_token_account {
        msg!(
            "expected token account {} for mint {} and account {}, recieved {}",
            expected_token_account,
            mint_account_info.key,
            account_info.key,
            token_account_info.key
        );
        return Err(ProgramError::InvalidAccountData);
    }

    return Ok(());
}
