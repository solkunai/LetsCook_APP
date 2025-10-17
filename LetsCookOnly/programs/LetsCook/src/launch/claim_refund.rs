use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::launch::{JoinData, LaunchData, LaunchFlags, LaunchKeys, TicketStatus};
use crate::{accounts, instruction::accounts::ClaimRefundAccounts, utils};

pub fn claim_refund<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    msg!("in claim_refund, getting accounts");

    let ctx: crate::instruction::accounts::Context<ClaimRefundAccounts> = ClaimRefundAccounts::context(accounts)?;

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut join_data = JoinData::try_from_slice(&ctx.accounts.join_data.data.borrow()[..])?;

    let mut launch_data = LaunchData::try_from_slice(&ctx.accounts.launch_data.data.borrow()[..])?;

    let _launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.launch_data, program_id, vec![launch_data.page_name.as_bytes(), b"Launch"]).unwrap();

    let _player_join_bump = accounts::check_program_data_account(
        ctx.accounts.join_data,
        program_id,
        vec![&ctx.accounts.user.key.to_bytes(), &launch_data.page_name.as_bytes(), b"Joiner"],
    )
    .unwrap();

    let temp_account_bump =
        accounts::check_program_data_account(ctx.accounts.temp_wsol, program_id, vec![&ctx.accounts.user.key.to_bytes(), b"Temp"]).unwrap();

    if *ctx.accounts.launch_quote.key != launch_data.keys[LaunchKeys::WSOLAddress as usize] {
        msg!("WSOL account does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    accounts::check_wrapped_sol_key(ctx.accounts.quote_token_mint)?;

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;
    let _quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;

    // Handle other checks
    // the temp account shouldn't already exist
    if **ctx.accounts.temp_wsol.try_borrow_lamports()? != 0 {
        msg!("Temp WSOL account already exists");
        return Err(ProgramError::InvalidAccountData);
    }

    // joiner can't be the seller
    if ctx.accounts.user.key != &join_data.joiner_key {
        msg!("user does not own joiner data");
        return Err(ProgramError::InvalidAccountData);
    }

    // it must be after the close
    let clock = Clock::get()?;

    // can only claim tickets if it is after launch has ended
    if clock.unix_timestamp < (launch_data.end_date / 1000) as i64 {
        msg!("Launch not yet ended, cannot claim refund");
        return Err(ProgramError::InvalidAccountData);
    }

    // the mint must have also failed
    let lp_valid: bool =
        launch_data.flags[LaunchFlags::LPState as usize] == 2 || clock.unix_timestamp < (launch_data.end_date / 1000 + 2 * 7 * 24 * 60 * 60) as i64;

    if launch_data.tickets_sold >= launch_data.num_mints && launch_data.flags[LaunchFlags::LaunchFailed as usize] == 0 && lp_valid {
        msg!("Launch Succeeded, cannot collect refund");
        return Err(ProgramError::InvalidAccountData);
    }

    // they must have more than zero tickets
    if join_data.num_tickets == 0 {
        msg!("No tickets to refund");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut tickets_to_refund = join_data.num_tickets;
    if join_data.ticket_status == TicketStatus::LosingRefunded {
        let losing_tickets = join_data.num_tickets - join_data.num_winning_tickets;
        tickets_to_refund -= losing_tickets;
    }

    let ticket_cost = launch_data.ticket_price * tickets_to_refund as u64;

    utils::unwrap_wsol(
        ticket_cost,
        ctx.accounts.user,
        ctx.accounts.user,
        ctx.accounts.temp_wsol,
        ctx.accounts.cook_pda,
        ctx.accounts.launch_quote,
        ctx.accounts.quote_token_mint,
        ctx.accounts.quote_token_program,
        pda_sol_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        temp_account_bump,
    )?;

    launch_data.tickets_sold -= join_data.num_tickets as u32;

    // mark this launch as failed
    launch_data.flags[LaunchFlags::LaunchFailed as usize] = 1;
    launch_data.serialize(&mut &mut ctx.accounts.launch_data.data.borrow_mut()[..])?;

    join_data.ticket_status = TicketStatus::FullyRefunded;
    join_data.num_tickets = 0;
    join_data.serialize(&mut &mut ctx.accounts.join_data.data.borrow_mut()[..])?;

    let joiner_account_lamports = **ctx.accounts.join_data.try_borrow_lamports()?;
    msg!("close joiner account for {} lamports", joiner_account_lamports);
    **ctx.accounts.join_data.try_borrow_mut_lamports()? -= joiner_account_lamports;
    **ctx.accounts.user.try_borrow_mut_lamports()? += joiner_account_lamports;

    Ok(())
}
