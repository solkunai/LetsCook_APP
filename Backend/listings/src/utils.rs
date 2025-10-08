use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    pubkey::Pubkey,
    rent,
};

use crate::state;

pub fn calculate_rent(size: u64) -> u64 {
    if state::NETWORK != state::Network::Eclipse {
        return rent::Rent::default().minimum_balance(size as usize);
    }

    let eclipse_rent = rent::Rent {
        lamports_per_byte_year: 1_000_000_000 / 10_000 * 365 / (1024 * 1024),
        exemption_threshold: 2.0,
        burn_percent: 0,
    };

    let rent_amount = eclipse_rent.minimum_balance(size as usize);

    msg!("Rent amount: {} for size {}", rent_amount, size);
    return rent_amount;
}

pub fn create_program_account<'a>(
    funding_account: &AccountInfo<'a>,
    pda: &AccountInfo<'a>,
    program_id: &Pubkey,
    bump_seed: u8,
    data_size: usize,
    seed: Vec<&[u8]>,
) -> ProgramResult {
    // Check if the account has already been initialized
    if **pda.try_borrow_lamports()? > 0 {
        msg!("This account is already initialized. skipping");
        return Ok(());
    }

    msg!("Creating program derived account");

    let space: u64 = data_size as u64;
    let lamports = calculate_rent(space);

    msg!("Require {} lamports for {} size data", lamports, data_size);
    let ix = solana_program::system_instruction::create_account(
        funding_account.key,
        pda.key,
        lamports,
        space,
        program_id,
    );

    // Sign and submit transaction

    if seed.len() == 0 {
        invoke(&ix, &[funding_account.clone(), pda.clone()])?;
    }

    if seed.len() == 1 {
        // Sign and submit transaction
        invoke_signed(
            &ix,
            &[funding_account.clone(), pda.clone()],
            &[&[seed[0], &[bump_seed]]],
        )?;
    }

    if seed.len() == 2 {
        // Sign and submit transaction
        invoke_signed(
            &ix,
            &[funding_account.clone(), pda.clone()],
            &[&[seed[0], seed[1], &[bump_seed]]],
        )?;
    }

    if seed.len() == 3 {
        // Sign and submit transaction
        invoke_signed(
            &ix,
            &[funding_account.clone(), pda.clone()],
            &[&[seed[0], seed[1], seed[2], &[bump_seed]]],
        )?;
    }

    Ok(())
}
