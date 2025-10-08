use borsh::{BorshDeserialize, BorshSerialize};

use mpl_core::instructions::TransferV1CpiBuilder;
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg,
    program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::{
    accounts,
    instruction::accounts::ResolveMissionAccounts,
    state::{MissionStatus, UserData},
    utils::{self, send_citizen_to_cook},
};

fn set_attributes<'a>(
    user_account_info: &'a AccountInfo<'a>,
    pda: &'a AccountInfo<'a>,
    pda_bump_seed: u8,
    system_program_account_info: &'a AccountInfo<'a>,
    core_account_info: &'a AccountInfo<'a>,
    asset_mint_account_info: &'a AccountInfo<'a>,
    collection_mint_account_info: &'a AccountInfo<'a>,
    mission_difficulty: u8,
) -> ProgramResult {
    // see if we need to generate some attributes
    let asset = mpl_core::Asset::from_bytes(&asset_mint_account_info.data.borrow()[..])?;

    let attributes_plugin = asset.plugin_list.attributes;

    let mut attribute_list: Vec<mpl_core::types::Attribute> =
        attributes_plugin.unwrap().attributes.attribute_list.clone();

    let level_increase = if mission_difficulty == 0 {
        1
    } else if mission_difficulty == 1 {
        1
    } else {
        1
    };

    let wealth_multiplier: f32 = if mission_difficulty == 0 {
        1.0 + 1.0 / 3.0
    } else if mission_difficulty == 1 {
        2.0
    } else {
        4.0
    };

    // update level
    let current_level = attribute_list[1].value.clone();
    let level = current_level.parse::<i32>().unwrap();
    let incremented = level + level_increase;
    attribute_list[1].value = incremented.to_string();

    // update wealth
    let current_wealth = attribute_list[2].value.clone();
    let wealth = current_wealth.parse::<f32>().unwrap();
    let new_wealth = wealth * wealth_multiplier;
    attribute_list[2].value = new_wealth.floor().to_string();

    mpl_core::instructions::UpdatePluginV1CpiBuilder::new(core_account_info)
        .collection(Some(collection_mint_account_info))
        .asset(asset_mint_account_info)
        .payer(user_account_info)
        .authority(Some(pda))
        .plugin(mpl_core::types::Plugin::Attributes(
            mpl_core::types::Attributes {
                attribute_list: attribute_list,
            },
        ))
        .system_program(system_program_account_info)
        .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_bump_seed]]])?;

    return Ok(());
}

pub fn resolve_mission<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    msg!("In Resolve Mission");
    let ctx: crate::instruction::accounts::Context<ResolveMissionAccounts> =
        ResolveMissionAccounts::context(accounts)?;

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let _user_data_bump_seed = accounts::check_program_data_account(
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

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    if **ctx.accounts.user_data.try_borrow_lamports()? == 0 {
        msg!("UserData does not exist");
        return Err(ProgramError::InvalidAccountData);
    }

    // Deserialize listing to check seller
    let mut user_data = UserData::try_from_slice(&ctx.accounts.user_data.data.borrow())?;

    if user_data.mission_status != MissionStatus::InProgress as u8 {
        msg!("User not in a mission");
        return Err(ProgramError::InvalidAccountData);
    }

    let clock = Clock::get()?;
    if user_data.slot == clock.slot {
        msg!("Cannot resolve mission in the same slot");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut seed = u64::try_from_slice(&ctx.accounts.randoms.data.borrow()[56..64])?;
    if seed == 0 {
        msg!("invalid seed");
        return Err(ProgramError::InvalidAccountData);
    }

    const NUM_RANDOMS: usize = 25;
    let mut randoms = [0.; NUM_RANDOMS];

    for i in 0..NUM_RANDOMS {
        seed = utils::shift_seed(seed);
        randoms[i] = utils::generate_random_f64(seed);
    }

    let win_prob: u16 = if user_data.mission_difficulty == 0 {
        75
    } else if user_data.mission_difficulty == 1 {
        50
    } else {
        25
    };

    let win_roll = (randoms[0] * 100.0) as u16;
    if win_roll > win_prob {
        // user has lost
        msg!("Mission Failure {}", win_roll);
        user_data.mission_status = MissionStatus::Failure as u8;

        // send the citizen back to lets cook
        send_citizen_to_cook(
            ctx.accounts.lets_cook.key,
            ctx.accounts.pda,
            ctx.accounts.cook_user_data,
            ctx.accounts.cook_collection_data,
            ctx.accounts.cook_pda,
            ctx.accounts.token_mint,
            ctx.accounts.user_token,
            ctx.accounts.cook_token,
            ctx.accounts.team_token,
            ctx.accounts.asset,
            ctx.accounts.collection,
            ctx.accounts.token_program,
            ctx.accounts.associated_token,
            ctx.accounts.system_program,
            ctx.accounts.core_program,
            pda_bump_seed,
        )?;
    } else {
        msg!("Mission Success {}", win_roll);
        user_data.mission_status = MissionStatus::Success as u8;

        set_attributes(
            ctx.accounts.user,
            ctx.accounts.pda,
            pda_bump_seed,
            ctx.accounts.system_program,
            ctx.accounts.core_program,
            ctx.accounts.asset,
            ctx.accounts.collection,
            user_data.mission_difficulty,
        )?;

        // transfer the citizen back to the user
        let _transfer = TransferV1CpiBuilder::new(ctx.accounts.core_program)
            .asset(ctx.accounts.asset)
            .authority(Some(ctx.accounts.pda))
            .payer(ctx.accounts.user)
            .new_owner(ctx.accounts.user)
            .collection(Some(ctx.accounts.collection))
            .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_bump_seed]]])?;
    }
    user_data.asset = *ctx.accounts.system_program.key;
    user_data.randoms_address = *ctx.accounts.system_program.key;
    user_data.slot = clock.slot;

    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    let randoms_lamports = **ctx.accounts.randoms.try_borrow_lamports()?;
    **ctx.accounts.randoms.try_borrow_mut_lamports()? = 0;
    **ctx.accounts.user.try_borrow_mut_lamports()? += randoms_lamports;

    msg!("Mission Resolved");

    Ok(())
}
