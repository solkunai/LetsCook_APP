use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::{
    accounts,
    instruction::accounts::CheckTicketsAccounts,
    launch::{JoinData, LaunchData, LaunchKeys, LaunchMetaType},
    state, utils,
};

pub fn check_tickets<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<CheckTicketsAccounts> = CheckTicketsAccounts::context(accounts)?;

    msg!("Check Tickets");
    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    accounts::check_system_program_key(ctx.accounts.system_program)?;

    // check the game account is the same as is on chain
    let mut launch_data = LaunchData::try_from_slice(&ctx.accounts.launch_data.data.borrow()[..])?;

    let mut join_data = JoinData::try_from_slice(&ctx.accounts.join_data.data.borrow()[..])?;

    let _player_data_bump =
        accounts::check_program_data_account(ctx.accounts.user_data, program_id, vec![&ctx.accounts.user.key.to_bytes(), b"User"]).unwrap();

    let _player_join_bump = accounts::check_program_data_account(
        ctx.accounts.join_data,
        program_id,
        vec![&ctx.accounts.user.key.to_bytes(), &launch_data.page_name.as_bytes(), b"Joiner"],
    )
    .unwrap();

    let _launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.launch_data, program_id, vec![launch_data.page_name.as_bytes(), b"Launch"]).unwrap();

    // joiner can't be the seller
    if ctx.accounts.user.key == &launch_data.keys[LaunchKeys::Seller as usize] {
        return Err(ProgramError::InvalidAccountData);
    }

    // if there were fewer tickets than mints then we shouldn't be here
    if launch_data.tickets_sold < launch_data.num_mints {
        msg!("Launch failed, cannot check tickets");
        return Err(ProgramError::InvalidAccountData);
    }

    // player must be the joiner
    if ctx.accounts.user.key != &join_data.joiner_key {
        return Err(ProgramError::InvalidAccountData);
    }

    if join_data.num_tickets_checked >= join_data.num_tickets {
        msg!("Tickets all already checked");
        return Err(ProgramError::InvalidAccountData);
    }

    let clock = Clock::get()?;

    // can only join a launch if it is after launch but before end
    if clock.unix_timestamp < (launch_data.end_date / 1000) as i64 {
        msg!("Launch not yet finished, cannot check tickets");
        return Err(ProgramError::InvalidAccountData);
    }

    launch_data.num_interactions += 1;

    let slot = Clock::get()?.slot;
    if join_data.last_slot == slot {
        msg!("Check Tickets called multiple times on the same slot");
        return Err(ProgramError::InvalidAccountData);
    }

    join_data.last_slot = slot;

    // if tickets sold = num mints everyones a winner, this is also the fcfs case
    // if this is an ido launch then it is also true that all tickets win
    let launch_type: LaunchMetaType = LaunchMetaType::from(&launch_data.launch_meta);
    if launch_data.num_mints == launch_data.tickets_sold || launch_type == LaunchMetaType::IDO {
        msg!("All Tickets are Winners");
        join_data.num_winning_tickets = join_data.num_tickets;
        join_data.num_tickets_checked = join_data.num_tickets;

        launch_data.mints_won += join_data.num_tickets as u32;
        launch_data.ticket_claimed += join_data.num_tickets as u32;

        launch_data.serialize(&mut &mut ctx.accounts.launch_data.data.borrow_mut()[..])?;
        join_data.serialize(&mut &mut ctx.accounts.join_data.data.borrow_mut()[..])?;
        return Ok(());
    }

    msg!("Have Raffle - check randoms");
    let ticket_block: u8 = (join_data.num_tickets_checked / state::N_RANDOMS as u16) as u8;
    let r_start: usize = (40 + ticket_block * 8) as usize;
    let r_end: usize = (r_start + 8) as usize;

    // each ticket just has probability to win of tickets remaining / num winning tickets
    let mut seed = u64::try_from_slice(&ctx.accounts.orao_random.data.borrow()[r_start..r_end])?;

    msg!("block {} seed {}", ticket_block, seed);
    if seed == 0 {
        msg!("invalid seed");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut tickets_remaining = launch_data.tickets_sold - launch_data.ticket_claimed;
    let mut mints_remaining = launch_data.num_mints - launch_data.mints_won;
    let mut new_wins = 0;

    // check max 200 tickets at a time
    let tickets_to_check = std::cmp::min(join_data.num_tickets - join_data.num_tickets_checked, state::N_RANDOMS as u16);
    for _i in 0..tickets_to_check {
        let ticket_prob = (mints_remaining as f64) / (tickets_remaining as f64);

        seed = utils::shift_seed(seed);
        let random = utils::generate_random_f64(seed);

        //msg!("random for {} is {}, prob {}", _i, random, ticket_prob);
        if random <= ticket_prob {
            //winner
            new_wins += 1;
            mints_remaining -= 1;
            tickets_remaining -= 1;
            continue;
        }

        // loser
        tickets_remaining -= 1;
    }

    msg!(
        "Total winning tickets {} of {} remaining {}",
        new_wins,
        tickets_to_check,
        join_data.num_tickets - (join_data.num_tickets_checked + tickets_to_check)
    );

    join_data.num_winning_tickets += new_wins;
    join_data.num_tickets_checked += tickets_to_check;

    launch_data.mints_won += new_wins as u32;
    launch_data.ticket_claimed += tickets_to_check as u32;

    launch_data.serialize(&mut &mut ctx.accounts.launch_data.data.borrow_mut()[..])?;
    join_data.serialize(&mut &mut ctx.accounts.join_data.data.borrow_mut()[..])?;

    Ok(())
}
