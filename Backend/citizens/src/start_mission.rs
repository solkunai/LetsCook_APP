use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use mpl_core::instructions::TransferV1CpiBuilder;
use sha2::{Digest, Sha256};

use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg,
    program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::{
    accounts,
    instruction::{accounts::StartMissionAccounts, StartMissionArgs},
    state::{self, MissionStatus, SummaryData, UserData},
    utils,
};
use std::convert::TryInto;

// create user data if it doesn't exist
// check user is not on a mission
// set user data
// generate randoms
// transfer asset
pub fn start_mission<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    args: StartMissionArgs,
) -> ProgramResult {
    msg!("In Start Mission");
    let ctx: crate::instruction::accounts::Context<StartMissionAccounts> =
        StartMissionAccounts::context(accounts)?;

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let user_data_bump_seed = accounts::check_program_data_account(
        ctx.accounts.user_data,
        program_id,
        vec![&ctx.accounts.user.key.to_bytes(), b"UserData"],
    )
    .unwrap();

    let pda_bump_seed = accounts::check_program_data_account(
        ctx.accounts.pda,
        program_id,
        vec![&accounts::SOL_SEED.to_le_bytes()],
    )
    .unwrap();

    let summary_bump_seed = accounts::check_program_data_account(
        ctx.accounts.summary,
        program_id,
        vec![&accounts::DATA_SEED.to_le_bytes()],
    )
    .unwrap();

    let random_bump = accounts::check_program_data_account(
        ctx.accounts.randoms,
        program_id,
        vec![b"orao-vrf-randomness-request", &args.seed],
    )
    .unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    accounts::check_core_key(ctx.accounts.core_program)?;

    if **ctx.accounts.pda.try_borrow_lamports()? == 0 {
        utils::create_program_account(
            ctx.accounts.user,
            ctx.accounts.pda,
            ctx.accounts.system_program.key,
            pda_bump_seed,
            0,
            vec![&accounts::SOL_SEED.to_le_bytes()],
        )?;

        /*mpl_core::instructions::UpdatePluginV1CpiBuilder::new(ctx.accounts.core_program)
        .collection(Some(ctx.accounts.collection))
        .payer(ctx.accounts.user)
        .authority(Some(ctx.accounts.pda))
        .plugin(mpl_core::types::Plugin::UpdateDelegate(
            mpl_core::types::UpdateDelegate {
                additional_delegates: vec![
                    *ctx.accounts.pda.key,
                    accounts::daoplays_account::id(),
                ],
            },
        ))
        .system_program(ctx.accounts.system_program)
        .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_bump_seed]]])?;*/
    }
    if **ctx.accounts.summary.try_borrow_lamports()? == 0 {
        utils::create_program_account(
            ctx.accounts.user,
            ctx.accounts.summary,
            program_id,
            summary_bump_seed,
            to_vec(&state::SummaryData::default()).unwrap().len(),
            vec![&accounts::DATA_SEED.to_le_bytes()],
        )?;
    }

    if **ctx.accounts.user_data.try_borrow_lamports()? == 0 {
        let data_len = to_vec(&UserData::default()).unwrap().len();
        msg!("create user account");
        utils::create_program_account(
            ctx.accounts.user,
            ctx.accounts.user_data,
            program_id,
            user_data_bump_seed,
            data_len,
            vec![&ctx.accounts.user.key.to_bytes(), b"UserData"],
        )?;
    }

    let mut user_data = UserData::try_from_slice(&ctx.accounts.user_data.data.borrow())?;

    if user_data.mission_status == MissionStatus::InProgress as u8 {
        msg!("mission already started");
        return Err(ProgramError::InvalidAccountData);
    }

    let clock = Clock::get()?;

    if user_data.slot == clock.slot {
        msg!("Cannot start mission in the same slot");
        return Err(ProgramError::InvalidAccountData);
    }

    // get the users level
    let asset = mpl_core::Asset::from_bytes(&ctx.accounts.asset.data.borrow()[..])?;
    let attributes_plugin = asset.plugin_list.attributes;
    let attribute_list: Vec<mpl_core::types::Attribute> =
        attributes_plugin.unwrap().attributes.attribute_list.clone();

    let current_level = attribute_list[1].value.clone();
    let level = current_level.parse::<i32>().unwrap();

    if args.difficulty == 1 && level < 5 {
        msg!("User level too low for medium {} < 5", level);
        return Err(ProgramError::InvalidAccountData);
    }
    if args.difficulty == 2 && level < 10 {
        msg!("User level too low for hard {} < 10", level);
        return Err(ProgramError::InvalidAccountData);
    }

    if level > 10 {
        msg!("User level too high for any mission {}", level);
        return Err(ProgramError::InvalidAccountData);
    }

    user_data.asset = *ctx.accounts.asset.key;
    user_data.mission_difficulty = args.difficulty;
    user_data.mission_status = MissionStatus::InProgress as u8;
    user_data.slot = clock.slot;
    user_data.randoms_address = *ctx.accounts.randoms.key;

    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    let index = asset
        .base
        .name
        .split('#')
        .nth(1)
        .ok_or(ProgramError::InvalidAccountData)? // Convert Option to Result
        .parse::<usize>()
        .map_err(|_| ProgramError::InvalidAccountData)?
        .div_euclid(100);

    msg!("Have asset number {}", index);

    let mut summary_data = SummaryData::try_from_slice(&ctx.accounts.summary.data.borrow())?;
    if args.difficulty == 0 {
        summary_data.easy_games_played[index] += 1;
    } else if args.difficulty == 1 {
        summary_data.medium_games_played[index] += 1;
    } else {
        summary_data.hard_games_played[index] += 1;
    }
    summary_data.serialize(&mut &mut ctx.accounts.summary.data.borrow_mut()[..])?;

    // handle the randoms
    // create the account
    msg!("create randoms account");
    utils::create_program_account(
        ctx.accounts.user,
        ctx.accounts.randoms,
        program_id,
        random_bump,
        104,
        vec![b"orao-vrf-randomness-request", &args.seed],
    )?;

    let mut seed_values = state::SeedStruct {
        seed_prices: [0; 10],
    };

    seed_values.seed_prices[0] = u64::from_le_bytes(args.seed[0..8].try_into().unwrap());
    seed_values.seed_prices[1] = u64::from_le_bytes(args.seed[8..16].try_into().unwrap());
    seed_values.seed_prices[2] = u64::from_le_bytes(args.seed[16..24].try_into().unwrap());
    seed_values.seed_prices[3] = u64::from_le_bytes(args.seed[24..32].try_into().unwrap());
    seed_values.seed_prices[4] = Clock::get()?.slot;
    seed_values.seed_prices[5] = Clock::get()?.unix_timestamp as u64;

    seed_values.seed_prices[6] =
        u64::from_le_bytes(ctx.accounts.user.key.to_bytes()[..8].try_into().unwrap());
    seed_values.seed_prices[7] =
        u64::from_le_bytes(ctx.accounts.user.key.to_bytes()[8..16].try_into().unwrap());
    seed_values.seed_prices[8] =
        u64::from_le_bytes(ctx.accounts.user.key.to_bytes()[16..24].try_into().unwrap());
    seed_values.seed_prices[9] =
        u64::from_le_bytes(ctx.accounts.user.key.to_bytes()[24..32].try_into().unwrap());

    let vec_to_hash = unsafe { utils::any_as_u8_slice(&seed_values) };
    let hash = &(Sha256::new().chain_update(vec_to_hash).finalize()[..32]);
    let mut hash_array = [0u8; 104];
    hash_array[40..72].copy_from_slice(&hash[..32]);
    hash_array[72..104].copy_from_slice(&hash[..32]);

    msg!("serialize randoms");
    hash_array.serialize(&mut &mut ctx.accounts.randoms.data.borrow_mut()[..])?;

    // transfer the citizen
    msg!("transfer citizen");
    let _transfer = TransferV1CpiBuilder::new(ctx.accounts.core_program)
        .asset(ctx.accounts.asset)
        .authority(Some(ctx.accounts.user))
        .payer(ctx.accounts.user)
        .new_owner(ctx.accounts.pda)
        .collection(Some(ctx.accounts.collection))
        .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_bump_seed]]])?;

    msg!("mission started");

    Ok(())
}
