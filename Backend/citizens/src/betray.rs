use borsh::{to_vec, BorshDeserialize, BorshSerialize};

use mpl_core::instructions::TransferV1CpiBuilder;
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg,
    program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::{
    accounts,
    instruction::accounts::BetrayAccounts,
    state::{MissionStatus, UserData},
    utils::{self, send_citizen_to_cook},
};

pub fn betray<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    msg!("In Betray");
    let ctx: crate::instruction::accounts::Context<BetrayAccounts> =
        BetrayAccounts::context(accounts)?;

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let user_data_bump_seed = accounts::check_program_data_account(
        ctx.accounts.betrayer_data,
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

    // check collection is what we expect
    // just also check that token is what we expect

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    accounts::check_core_key(ctx.accounts.core_program)?;

    let _is_2022 = accounts::check_token_program_key(ctx.accounts.token_program)?;

    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.user,
        ctx.accounts.token_mint,
        ctx.accounts.betrayer_token,
        ctx.accounts.token_program,
    )?;

    if **ctx.accounts.betrayer_data.try_borrow_lamports()? == 0 {
        let data_len = to_vec(&UserData::default()).unwrap().len();
        msg!("create user account");
        utils::create_program_account(
            ctx.accounts.user,
            ctx.accounts.betrayer_data,
            program_id,
            user_data_bump_seed,
            data_len,
            vec![&ctx.accounts.user.key.to_bytes(), b"UserData"],
        )?;
    }

    // Deserialize listing to check seller
    let mut user_data = UserData::try_from_slice(&ctx.accounts.betrayer_data.data.borrow())?;

    if user_data.mission_status == MissionStatus::InProgress as u8 {
        msg!("User in progress");
        return Err(ProgramError::InvalidAccountData);
    }

    if user_data.asset != *ctx.accounts.system_program.key {
        msg!("User not in at rest");
        return Err(ProgramError::InvalidAccountData);
    }

    let clock = Clock::get()?;
    if user_data.slot == clock.slot {
        msg!("Cannot betray in the same slot");
        return Err(ProgramError::InvalidAccountData);
    }

    // reset the user data
    user_data.slot = clock.slot;

    user_data.serialize(&mut &mut ctx.accounts.betrayer_data.data.borrow_mut()[..])?;

    let asset = mpl_core::Asset::from_bytes(&ctx.accounts.asset.data.borrow()[..])?;
    let attributes_plugin = asset.plugin_list.attributes;
    let attribute_list: Vec<mpl_core::types::Attribute> =
        attributes_plugin.unwrap().attributes.attribute_list.clone();

    // get current wealth
    let current_wealth = attribute_list[2].value.clone();
    let wealth = current_wealth.parse::<f32>().unwrap();

    let wealth_tokens = (wealth * 10_f32.powi(6)) as u64;

    let fees_tokens = ((wealth_tokens as f64) * 0.01) as u64;

    let user_tokens = wealth_tokens - fees_tokens;

    // transfer the citizen
    msg!("transfer citizen");
    let _transfer = TransferV1CpiBuilder::new(ctx.accounts.core_program)
        .asset(ctx.accounts.asset)
        .authority(Some(ctx.accounts.user))
        .payer(ctx.accounts.user)
        .new_owner(ctx.accounts.pda)
        .collection(Some(ctx.accounts.collection))
        .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_bump_seed]]])?;

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

    // transfer the tokens
    utils::transfer_t22_tokens(
        fees_tokens,
        ctx.accounts.team_token,
        ctx.accounts.token_mint,
        ctx.accounts.fees_token,
        ctx.accounts.pda,
        ctx.accounts.token_program,
        pda_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        6,
        &vec![],
    )?;

    // transfer the tokens
    utils::transfer_t22_tokens(
        user_tokens,
        ctx.accounts.team_token,
        ctx.accounts.token_mint,
        ctx.accounts.betrayer_token,
        ctx.accounts.pda,
        ctx.accounts.token_program,
        pda_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        6,
        &vec![],
    )?;

    Ok(())
}
