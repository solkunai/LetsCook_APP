use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    instruction::AccountMeta,
    msg,
    native_token::LAMPORTS_PER_SOL,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent, system_instruction,
};

use spl_associated_token_account::instruction::create_associated_token_account;
use spl_token_2022::instruction as tokenInstruction;

use std::mem;

use crate::{
    accounts,
    state::{self, UserData},
};
pub fn to_sol(value: u64) -> f64 {
    (value as f64) / (LAMPORTS_PER_SOL as f64)
}

pub fn to_lamports(value: f64) -> u64 {
    (value * LAMPORTS_PER_SOL as f64) as u64
}

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

    let space: u64 = data_size.try_into().unwrap();
    let lamports = calculate_rent(space);

    msg!("Require {} lamports for {} size data", lamports, data_size);
    let ix = solana_program::system_instruction::create_account(funding_account.key, pda.key, lamports, space, program_id);

    // Sign and submit transaction

    if seed.len() == 0 {
        invoke(&ix, &[funding_account.clone(), pda.clone()])?;
    }

    if seed.len() == 1 {
        // Sign and submit transaction
        invoke_signed(&ix, &[funding_account.clone(), pda.clone()], &[&[seed[0], &[bump_seed]]])?;
    }

    if seed.len() == 2 {
        // Sign and submit transaction
        invoke_signed(&ix, &[funding_account.clone(), pda.clone()], &[&[seed[0], seed[1], &[bump_seed]]])?;
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

pub fn transfer_tokens<'a>(
    is_2022: bool,
    amount: u64,
    token_source_account: &AccountInfo<'a>,
    token_mint_account: &AccountInfo<'a>,
    token_dest_account: &AccountInfo<'a>,
    authority_account: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    bump_seed: u8,
    seed: &Vec<&[u8]>,
    decimals: u8,
    transfer_hook_accounts: &Vec<&AccountInfo<'a>>,
) -> Result<(), ProgramError> {
    if is_2022 {
        return transfer_t22_tokens(
            amount,
            token_source_account,
            token_mint_account,
            token_dest_account,
            authority_account,
            token_program,
            bump_seed,
            seed,
            decimals,
            transfer_hook_accounts,
        );
    } else {
        return transfer_spl_tokens(
            amount,
            token_source_account,
            token_dest_account,
            authority_account,
            token_program,
            bump_seed,
            seed,
        );
    }
}

fn transfer_spl_tokens<'a>(
    amount: u64,
    token_source_account: &AccountInfo<'a>,
    token_dest_account: &AccountInfo<'a>,
    authority_account: &AccountInfo<'a>,
    token_program_account: &AccountInfo<'a>,
    bump_seed: u8,
    seed: &Vec<&[u8]>,
) -> ProgramResult {
    let ix = spl_token::instruction::transfer(
        token_program_account.key,
        token_source_account.key,
        token_dest_account.key,
        authority_account.key,
        &[],
        amount,
    )?;

    // Sign and submit transaction
    if seed.len() == 1 {
        // Sign and submit transaction
        invoke_signed(
            &ix,
            &[
                token_source_account.clone(),
                token_dest_account.clone(),
                authority_account.clone(),
                token_program_account.clone(),
            ],
            &[&[seed[0], &[bump_seed]]],
        )?;
    }

    if seed.len() == 2 {
        // Sign and submit transaction
        invoke_signed(
            &ix,
            &[
                token_source_account.clone(),
                token_dest_account.clone(),
                authority_account.clone(),
                token_program_account.clone(),
            ],
            &[&[seed[0], seed[1], &[bump_seed]]],
        )?;
    }

    if seed.len() == 3 {
        // Sign and submit transaction
        invoke_signed(
            &ix,
            &[
                token_source_account.clone(),
                token_dest_account.clone(),
                authority_account.clone(),
                token_program_account.clone(),
            ],
            &[&[seed[0], seed[1], seed[2], &[bump_seed]]],
        )?;
    }

    Ok(())
}

fn transfer_t22_tokens<'a>(
    amount: u64,
    token_source_account: &AccountInfo<'a>,
    token_mint_account: &AccountInfo<'a>,
    token_dest_account: &AccountInfo<'a>,
    authority_account: &AccountInfo<'a>,
    token_program_2022_account: &AccountInfo<'a>,
    bump_seed: u8,
    seed: &Vec<&[u8]>,
    decimals: u8,
    transfer_hook_accounts: &Vec<&AccountInfo<'a>>,
) -> ProgramResult {
    let mut ix = spl_token_2022::instruction::transfer_checked(
        token_program_2022_account.key,
        token_source_account.key,
        token_mint_account.key,
        token_dest_account.key,
        authority_account.key,
        &[],
        amount,
        decimals,
    )?;

    let mut account_infos = vec![
        token_source_account.clone(),
        token_mint_account.clone(),
        token_dest_account.clone(),
        authority_account.clone(),
        token_program_2022_account.clone(),
    ];

    if transfer_hook_accounts.len() > 0 {
        for i in 0..transfer_hook_accounts.len() {
            if transfer_hook_accounts[i].is_writable {
                ix.accounts
                    .push(AccountMeta::new(*transfer_hook_accounts[i].key, transfer_hook_accounts[i].is_signer));
            } else {
                ix.accounts.push(AccountMeta::new_readonly(
                    *transfer_hook_accounts[i].key,
                    transfer_hook_accounts[i].is_signer,
                ));
            }
            account_infos.push(transfer_hook_accounts[i].clone());
        }
    }

    if seed.len() == 0 {
        // submit transaction
        msg!("submitting user signed transfer");
        invoke(&ix, &account_infos)?;
    }

    // Sign and submit transaction
    if seed.len() == 1 {
        // Sign and submit transaction
        invoke_signed(&ix, &account_infos, &[&[seed[0], &[bump_seed]]])?;
    }

    if seed.len() == 2 {
        // Sign and submit transaction
        invoke_signed(&ix, &account_infos, &[&[seed[0], seed[1], &[bump_seed]]])?;
    }

    if seed.len() == 3 {
        // Sign and submit transaction
        invoke_signed(&ix, &account_infos, &[&[seed[0], seed[1], seed[2], &[bump_seed]]])?;
    }

    Ok(())
}

pub fn create_ata<'a>(
    funding_account: &AccountInfo<'a>,
    wallet_account: &AccountInfo<'a>,
    token_mint_account: &AccountInfo<'a>,
    new_token_account: &AccountInfo<'a>,
    token_program_account: &AccountInfo<'a>,
) -> ProgramResult {
    if **new_token_account.try_borrow_lamports()? > 0 {
        msg!("Token account is already initialised.");
        return Ok(());
    }

    msg!("creating Token account");
    let create_ata_idx = create_associated_token_account(
        &funding_account.key,
        &wallet_account.key,
        &token_mint_account.key,
        &token_program_account.key,
    );

    invoke(
        &create_ata_idx,
        &[
            funding_account.clone(),
            new_token_account.clone(),
            wallet_account.clone(),
            token_mint_account.clone(),
            token_program_account.clone(),
        ],
    )?;

    Ok(())
}

pub fn check_and_create_ata<'a>(
    funding_account: &'a AccountInfo<'a>,
    wallet_account: &'a AccountInfo<'a>,
    token_mint_account: &'a AccountInfo<'a>,
    new_token_account: &'a AccountInfo<'a>,
    token_program_account: &'a AccountInfo<'a>,
) -> ProgramResult {
    accounts::check_token_account(wallet_account, token_mint_account, new_token_account, token_program_account)?;

    create_ata(
        funding_account,
        wallet_account,
        token_mint_account,
        new_token_account,
        token_program_account,
    )?;

    Ok(())
}

pub fn wrap_sol<'a>(amount: u64, source: &AccountInfo<'a>, destination: &AccountInfo<'a>, token_program: &AccountInfo<'a>) -> ProgramResult {
    invoke(
        &system_instruction::transfer(source.key, destination.key, amount),
        &[source.clone(), destination.clone()],
    )?;

    let sync_idx = tokenInstruction::sync_native(token_program.key, destination.key)?;

    invoke(&sync_idx, &[token_program.clone(), destination.clone()])?;
    Ok(())
}

pub fn unwrap_wsol<'a>(
    amount: u64,
    fee_payer_account_info: &AccountInfo<'a>,
    destination_account_info: &AccountInfo<'a>,
    temp_wsol_account_info: &AccountInfo<'a>,
    authority_account: &AccountInfo<'a>,
    source_wsol_account_info: &AccountInfo<'a>,
    wsol_mint_account_info: &AccountInfo<'a>,
    token_program_account_info: &AccountInfo<'a>,
    pda_bump_seed: u8,
    pda_seeds: &Vec<&[u8]>,
    temp_bump_seed: u8,
) -> ProgramResult {
    let token_lamports = calculate_rent(spl_token::state::Account::LEN as u64);

    // create the temporary wsol account
    let base_ix = solana_program::system_instruction::create_account(
        fee_payer_account_info.key,
        temp_wsol_account_info.key,
        token_lamports,
        spl_token::state::Account::LEN as u64,
        token_program_account_info.key,
    );

    invoke_signed(
        &base_ix,
        &[
            fee_payer_account_info.clone(),
            temp_wsol_account_info.clone(),
            token_program_account_info.clone(),
        ],
        &[&[&fee_payer_account_info.key.to_bytes(), b"Temp", &[temp_bump_seed]]],
    )?;

    let init_base_idx = tokenInstruction::initialize_account3(
        token_program_account_info.key,
        temp_wsol_account_info.key,
        wsol_mint_account_info.key,
        fee_payer_account_info.key,
    )
    .unwrap();

    invoke_signed(
        &init_base_idx,
        &[
            token_program_account_info.clone(),
            temp_wsol_account_info.clone(),
            wsol_mint_account_info.clone(),
            fee_payer_account_info.clone(),
        ],
        &[&[&fee_payer_account_info.key.to_bytes(), b"Temp", &[temp_bump_seed]]],
    )?;

    self::transfer_spl_tokens(
        amount,
        source_wsol_account_info,
        temp_wsol_account_info,
        authority_account,
        token_program_account_info,
        pda_bump_seed,
        pda_seeds,
    )?;

    let close_idx = tokenInstruction::close_account(
        token_program_account_info.key,
        temp_wsol_account_info.key,
        destination_account_info.key,
        fee_payer_account_info.key,
        &[],
    )?;

    invoke_signed(
        &close_idx,
        &[
            token_program_account_info.clone(),
            temp_wsol_account_info.clone(),
            destination_account_info.clone(),
            fee_payer_account_info.clone(),
        ],
        &[&[&fee_payer_account_info.key.to_bytes(), b"Temp", &[temp_bump_seed]]],
    )?;

    Ok(())
}

pub unsafe fn any_as_u8_slice<T: Sized>(p: &T) -> &[u8] {
    ::std::slice::from_raw_parts((p as *const T) as *const u8, ::std::mem::size_of::<T>())
}

// A xorshift* generator as suggested by Marsaglia.
// The following 64-bit generator with 64 bits of state has a maximal period of 2^64−1
// and fails only the MatrixRank test of BigCrush
// see https://en.wikipedia.org/wiki/Xorshift
pub fn shift_seed(mut seed: u64) -> u64 {
    seed ^= seed >> 12;
    seed ^= seed << 25;
    seed ^= seed >> 27;
    seed *= 0x2545F4914F6CDD1D;

    return seed;
}

// convert the u64 into a double with range 0..1
pub fn generate_random_f64(seed: u64) -> f64 {
    let tmp = 0x3FF0000000000000 | (seed & 0xFFFFFFFFFFFFF);
    let result: f64 = unsafe { mem::transmute(tmp) };

    return result - 1.0;
}

pub fn check_for_realloc<'a>(data_account: &AccountInfo<'a>, user_account: &AccountInfo<'a>, old_size: usize, new_size: usize) -> ProgramResult {
    let old_lamports = calculate_rent(old_size as u64);
    let new_lamports = calculate_rent(new_size as u64);

    if new_lamports > old_lamports {
        msg!(
            "update launch account from {}  new size: {} current_balance: {} new_balance {}",
            old_size,
            new_size,
            old_lamports,
            new_lamports
        );

        invoke(
            &system_instruction::transfer(user_account.key, data_account.key, new_lamports - old_lamports),
            &[user_account.clone(), data_account.clone()],
        )?;
    }

    data_account.realloc(new_size, false)?;

    Ok(())
}

pub fn burn<'a>(
    amount: u64,
    token_program: &AccountInfo<'a>,
    token_mint: &AccountInfo<'a>,
    token_account: &AccountInfo<'a>,
    user: &AccountInfo<'a>,
    bump_seed: u8,
    seed: &Vec<&[u8]>,
) -> ProgramResult {
    let burn_instruction =
        spl_token_2022::instruction::burn(&token_program.key, &token_account.key, &token_mint.key, &user.key, &[], amount).unwrap();

    let account_infos = vec![token_program.clone(), token_account.clone(), token_mint.clone(), user.clone()];

    if seed.len() == 0 {
        // submit transaction
        msg!("submitting user signed burn");
        invoke(&burn_instruction, &account_infos)?;
    }

    // Sign and submit transaction
    if seed.len() == 1 {
        // Sign and submit transaction
        invoke_signed(&burn_instruction, &account_infos, &[&[seed[0], &[bump_seed]]])?;
    }

    if seed.len() == 2 {
        // Sign and submit transaction
        invoke_signed(&burn_instruction, &account_infos, &[&[seed[0], seed[1], &[bump_seed]]])?;
    }

    if seed.len() == 3 {
        // Sign and submit transaction
        invoke_signed(&burn_instruction, &account_infos, &[&[seed[0], seed[1], seed[2], &[bump_seed]]])?;
    }

    Ok(())
}

pub fn create_user_data<'a>(user: &'a AccountInfo<'a>, pda: &'a AccountInfo<'a>, program_id: &Pubkey) -> ProgramResult {
    let user_data_bump = accounts::check_program_data_account(pda, program_id, vec![&user.key.to_bytes(), b"User"]).unwrap();

    if **pda.try_borrow_lamports()? > 0 {
        msg!("User account is already initialized. skipping");
        return Ok(());
    }

    // check if this person has a player account
    create_program_account(
        user,
        pda,
        program_id,
        user_data_bump,
        state::get_user_data_size(),
        vec![&user.key.to_bytes(), b"User"],
    )?;

    let mut user_data = UserData::try_from_slice(&pda.data.borrow()[..])?;

    // if we just created the user data then set it up
    if user_data.account_type != state::AccountType::User {
        user_data.account_type = state::AccountType::User;
        user_data.user_key = *user.key;
        user_data.user_name = "".to_string();
        user_data.votes = Vec::new();
        user_data.stats = state::UserStats::default();

        user_data.serialize(&mut &mut pda.data.borrow_mut()[..])?;
    }

    Ok(())
}
