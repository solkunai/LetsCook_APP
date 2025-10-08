use crate::{accounts, instruction::WrapIdx, state};
use borsh::to_vec;
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    instruction::AccountMeta,
    msg,
    program::{invoke, invoke_signed},
    pubkey::Pubkey,
    rent,
};
use spl_associated_token_account::instruction::create_associated_token_account;

use std::mem;

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

pub fn send_citizen_to_cook<'a>(
    lets_cook_program: &Pubkey,
    pda: &AccountInfo<'a>,
    cook_user_data: &AccountInfo<'a>,
    cook_collection_data: &AccountInfo<'a>,
    cook_pda: &AccountInfo<'a>,
    token_mint: &AccountInfo<'a>,
    user_token: &AccountInfo<'a>,
    cook_token: &AccountInfo<'a>,
    team_token: &AccountInfo<'a>,
    asset: &AccountInfo<'a>,
    collection: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    associated_token: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    core_program: &AccountInfo<'a>,
    pda_bump_seed: u8,
) -> ProgramResult {
    let instruction_data = WrapIdx { idx: 16 };

    invoke_signed(
        &solana_program::instruction::Instruction {
            program_id: *lets_cook_program,
            accounts: vec![
                AccountMeta::new(*pda.key, true),
                AccountMeta::new(*cook_user_data.key, false),
                AccountMeta::new(*cook_collection_data.key, false),
                AccountMeta::new(*cook_pda.key, false),
                AccountMeta::new(*token_mint.key, false),
                AccountMeta::new(*user_token.key, false),
                AccountMeta::new(*cook_token.key, false),
                AccountMeta::new(*team_token.key, false),
                AccountMeta::new(*asset.key, false),
                AccountMeta::new(*collection.key, false),
                AccountMeta::new_readonly(*token_program.key, false),
                AccountMeta::new_readonly(*associated_token.key, false),
                AccountMeta::new_readonly(*system_program.key, false),
                AccountMeta::new_readonly(*core_program.key, false),
            ],
            data: to_vec(&instruction_data).unwrap(),
        },
        &[
            pda.clone(),
            cook_user_data.clone(),
            cook_collection_data.clone(),
            cook_pda.clone(),
            token_mint.clone(),
            user_token.clone(),
            cook_token.clone(),
            team_token.clone(),
            asset.clone(),
            collection.clone(),
            token_program.clone(),
            associated_token.clone(),
            system_program.clone(),
            core_program.clone(),
        ],
        &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_bump_seed]]],
    )
}

pub fn transfer_t22_tokens<'a>(
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
                ix.accounts.push(AccountMeta::new(
                    *transfer_hook_accounts[i].key,
                    transfer_hook_accounts[i].is_signer,
                ));
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
        invoke_signed(
            &ix,
            &account_infos,
            &[&[seed[0], seed[1], seed[2], &[bump_seed]]],
        )?;
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
    accounts::check_token_account(
        wallet_account,
        token_mint_account,
        new_token_account,
        token_program_account,
    )?;

    create_ata(
        funding_account,
        wallet_account,
        token_mint_account,
        new_token_account,
        token_program_account,
    )?;

    Ok(())
}
