use crate::state;
use crate::utils;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    instruction::AccountMeta,
    msg,
    program::invoke,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::rent,
};

use spl_type_length_value::state::TlvStateBorrowed;

use crate::instruction::{ExecuteInstruction, TransferHookInstruction};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};

use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token_2022;

use crate::accounts;
pub struct Processor;
impl Processor {
    /// Processes an [Instruction](enum.Instruction.html).
    pub fn process<'a>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'a>],
        instruction_data: &[u8],
    ) -> ProgramResult {
        // let instruction = TransferHookInstruction::try_from_slice(&instruction_data[..])?;

        msg!("unpack");
        let instruction = TransferHookInstruction::unpack(instruction_data)?;

        match instruction {
            TransferHookInstruction::Execute { amount } => {
                msg!("Instruction: Execute");
                Self::process_execute(program_id, accounts, amount)
            }
            TransferHookInstruction::InitializeExtraAccountMetaList => {
                msg!("Instruction: InitializeExtraAccountMetaList");
                Self::process_initialize_extra_account_metas(program_id, accounts)
            }
        }
    }

    /// Processes an [Execute](enum.TransferHookInstruction.html) instruction.
    pub fn process_execute<'a>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'a>],
        amount: u64,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        msg!("in execute");

        let source_account_info = next_account_info(account_info_iter)?;
        let mint_info = next_account_info(account_info_iter)?;
        let destination_account_info = next_account_info(account_info_iter)?;
        let authority_info = next_account_info(account_info_iter)?;
        let extra_account_metas_info = next_account_info(account_info_iter)?;

        let launch_data_account_info = next_account_info(account_info_iter)?;
        let amm_data_account_info = next_account_info(account_info_iter)?;

        let expected_validation_address =
            utils::get_extra_account_metas_address(mint_info.key, program_id);
        if expected_validation_address != *extra_account_metas_info.key {
            return Err(ProgramError::InvalidSeeds);
        }

        let launch_data =
            state::LaunchData::try_from_slice(&launch_data_account_info.data.borrow()[..])?;

        let amm_data = state::AMM::try_from_slice(&amm_data_account_info.data.borrow()[..])?;

        let _launch_bump_seed = accounts::check_program_data_account(
            launch_data_account_info,
            &accounts::lets_cook_program::ID,
            vec![launch_data.page_name.as_bytes(), b"Launch"],
        )
        .unwrap();

        // check if the source was lets cook as we don't want to charge fees for that
        let lets_cook_token_account = get_associated_token_address_with_program_id(
            &accounts::lets_cook_pda::ID,
            &mint_info.key,
            &spl_token_2022::id(),
        );

        if *source_account_info.key == lets_cook_token_account {
            let transferring = launch_data.flags[state::LaunchFlags::Transferring as usize];
            msg!("token transfer was from lets cook {}", transferring);

            if transferring == 0 {
                msg!("unauthorised transfer from Lets Cook");
                return Err(ProgramError::InvalidAccountData);
            }
        }

        // check if this was from the AMM
        let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
        state::get_amm_seeds(
            *mint_info.key,
            accounts::wrapped_sol_mint_account::ID,
            &mut amm_seed_keys,
        );

        let (amm_account, _amm_bump_seed) = Pubkey::find_program_address(
            &[
                &amm_seed_keys[0].to_bytes(),
                &amm_seed_keys[1].to_bytes(),
                b"AMM",
            ],
            &accounts::lets_cook_program::ID,
        );

        let amm_token_account = get_associated_token_address_with_program_id(
            &amm_account,
            &mint_info.key,
            &spl_token_2022::id(),
        );

        if *source_account_info.key == amm_token_account {
            msg!(
                "token transfer was from lets cook AMM: {}",
                amm_data.transferring
            );
            if amm_data.transferring == 0 {
                msg!("unauthorised transfer from Lets Cook AMM");
                return Err(ProgramError::InvalidAccountData);
            }
        }

        Ok(())
    }

    pub fn process_initialize_extra_account_metas<'a>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'a>],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        let extra_account_metas_info = next_account_info(account_info_iter)?;
        let mint_info = next_account_info(account_info_iter)?;
        let authority_info = next_account_info(account_info_iter)?;
        let _system_program_info = next_account_info(account_info_iter)?;

        let launch_data_account_info = next_account_info(account_info_iter)?;

        msg!("In Lets Cook Transfer Hook Initialize Account Metas");
        // Check signers
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let launch_data =
            state::LaunchData::try_from_slice(&launch_data_account_info.data.borrow()[..])?;

        let _launch_bump_seed = accounts::check_program_data_account(
            launch_data_account_info,
            &accounts::lets_cook_program::ID,
            vec![launch_data.page_name.as_bytes(), b"Launch"],
        )
        .unwrap();

        // Check validation account
        let (expected_validation_address, bump_seed) =
            utils::get_extra_account_metas_address_and_bump_seed(mint_info.key, program_id);

        if expected_validation_address != *extra_account_metas_info.key {
            return Err(ProgramError::InvalidSeeds);
        }

        // check if this was from the AMM
        let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
        state::get_amm_seeds(
            *mint_info.key,
            accounts::wrapped_sol_mint_account::ID,
            &mut amm_seed_keys,
        );

        let (amm_account, _amm_bump_seed) = Pubkey::find_program_address(
            &[
                &amm_seed_keys[0].to_bytes(),
                &amm_seed_keys[1].to_bytes(),
                b"AMM",
            ],
            &accounts::lets_cook_program::ID,
        );

        let n_extra_accounts = 2;

        let mut extra_account_infos: Vec<ExtraAccountMeta> = vec![];
        // if we did pass a mint_data account then create that now
        msg!("Create extra account infos");

        // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
        // index 4 is address of ExtraAccountMetaList account

        // index 5 is the launch data account
        let data_account_meta =
            ExtraAccountMeta::new_with_pubkey(launch_data_account_info.key, false, false).unwrap();

        // index 6 is the pda
        let amm_account_meta =
            ExtraAccountMeta::new_with_pubkey(&amm_account, false, false).unwrap();

        extra_account_infos.push(data_account_meta);
        extra_account_infos.push(amm_account_meta);

        let account_size = ExtraAccountMetaList::size_of(n_extra_accounts)?;

        msg!(
            "Have meta list of size {} for {} accounts",
            account_size,
            n_extra_accounts
        );

        let lamports = rent::Rent::default().minimum_balance(account_size);

        msg!(
            "Require {} lamports for {} size data",
            lamports,
            account_size
        );
        let ix = solana_program::system_instruction::create_account(
            authority_info.key,
            extra_account_metas_info.key,
            lamports,
            account_size as u64,
            program_id,
        );

        // Sign and submit transaction
        invoke_signed(
            &ix,
            &[authority_info.clone(), extra_account_metas_info.clone()],
            &[&[
                utils::EXTRA_ACCOUNT_METAS_SEED,
                mint_info.key.as_ref(),
                &[bump_seed],
            ]],
        )?;

        msg!("init extra account meta");
        let mut data = extra_account_metas_info.try_borrow_mut_data()?;

        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut data,
            &[extra_account_infos[0], extra_account_infos[1]],
        )?;

        Ok(())
    }
}
