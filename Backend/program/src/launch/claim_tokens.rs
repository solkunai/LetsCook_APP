use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

use crate::{
    accounts,
    instruction::accounts::ClaimTokensAccounts,
    launch::{Distribution, JoinData, LaunchData, LaunchFlags, LaunchKeys, LaunchMeta, Listing, TicketStatus, IDO},
    utils,
};

pub fn claim_tokens<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<ClaimTokensAccounts> = ClaimTokensAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // check the game account is the same as is on chain
    let mut launch_data = LaunchData::try_from_slice(&ctx.accounts.launch_data.data.borrow()[..])?;
    let listing = Listing::try_from_slice(&ctx.accounts.listing.data.borrow()[..])?;

    let _player_data_bump =
        accounts::check_program_data_account(ctx.accounts.user_data, program_id, vec![&ctx.accounts.user.key.to_bytes(), b"User"]).unwrap();

    let _player_join_bump = accounts::check_program_data_account(
        ctx.accounts.join_data,
        program_id,
        vec![&ctx.accounts.user.key.to_bytes(), &launch_data.page_name.as_bytes(), b"Joiner"],
    )
    .unwrap();

    let _listing_bump_seed = accounts::check_program_data_account(
        ctx.accounts.listing,
        program_id,
        vec![&ctx.accounts.base_token_mint.key.to_bytes(), b"Listing"],
    )
    .unwrap();

    let _launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.launch_data, program_id, vec![launch_data.page_name.as_bytes(), b"Launch"]).unwrap();

    let temp_account_bump =
        accounts::check_program_data_account(ctx.accounts.temp_wsol, program_id, vec![&ctx.accounts.user.key.to_bytes(), b"Temp"]).unwrap();

    if *ctx.accounts.launch_quote.key != launch_data.keys[LaunchKeys::WSOLAddress as usize] {
        msg!("WSOL account does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    accounts::check_wrapped_sol_key(ctx.accounts.quote_token_mint)?;

    accounts::check_token_account(
        ctx.accounts.cook_pda,
        ctx.accounts.base_token_mint,
        ctx.accounts.cook_base_token,
        ctx.accounts.base_token_program,
    )?;

    if *ctx.accounts.base_token_mint.key != listing.mint {
        msg!("Mint address account does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;
    accounts::check_associated_token_program_key(ctx.accounts.associated_token)?;
    let _quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;
    let base_2022 = accounts::check_token_program_key(ctx.accounts.base_token_program)?;

    // if the launch has failed then don't come here
    if launch_data.flags[LaunchFlags::LaunchFailed as usize] == 1 {
        msg!("Launch failed, cannot collect tickets, please collect refund");
        return Err(ProgramError::InvalidAccountData);
    }

    // if there were fewer tickets than mints then we shouldn't be here
    if launch_data.tickets_sold < launch_data.num_mints {
        msg!("Launch failed, cannot collect tickets, please collect refund");
        return Err(ProgramError::InvalidAccountData);
    }

    let clock = Clock::get()?;

    // can only claim tickets if it is after launch has ended
    if clock.unix_timestamp < (launch_data.end_date / 1000) as i64 {
        msg!("Launch not yet ended, cannot claim tokens");
        return Err(ProgramError::InvalidAccountData);
    }

    launch_data.num_interactions += 1;

    let mut join_data = JoinData::try_from_slice(&ctx.accounts.join_data.data.borrow()[..])?;

    // user must be the joiner
    if ctx.accounts.user.key != &join_data.joiner_key {
        return Err(ProgramError::InvalidAccountData);
    }

    // they must have some tickets
    if join_data.num_tickets == 0 {
        msg!("joiner has no tickets");
        return Err(ProgramError::InvalidAccountData);
    }

    if join_data.num_tickets_checked < join_data.num_tickets {
        msg!("Tickets still to be checked");
        return Err(ProgramError::InvalidAccountData);
    }

    if join_data.ticket_status == TicketStatus::FullyRefunded || join_data.ticket_status == TicketStatus::WinningClaimed {
        msg!("Tickets all already claimed");
        return Err(ProgramError::InvalidAccountData);
    }

    let winning_tickets = join_data.num_winning_tickets;
    let losing_tickets = join_data.num_tickets - winning_tickets;

    // handle the losing tickets, these get a refund on the ticket price
    if losing_tickets > 0 && join_data.ticket_status == TicketStatus::Available {
        let ticket_cost = launch_data.ticket_price * losing_tickets as u64;
        msg!(
            "Losing tickets: {} {} {}",
            utils::to_sol(launch_data.ticket_price),
            losing_tickets,
            utils::to_sol(ticket_cost)
        );

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

        join_data.ticket_status = TicketStatus::LosingRefunded;

        // if there were no winning tickets, just close the account
        if winning_tickets == 0 {
            join_data.serialize(&mut &mut ctx.accounts.join_data.data.borrow_mut()[..])?;

            let joiner_account_lamports = **ctx.accounts.join_data.try_borrow_lamports()?;
            msg!("close joiner account for {} lamports", joiner_account_lamports);
            **ctx.accounts.join_data.try_borrow_mut_lamports()? -= joiner_account_lamports;
            **ctx.accounts.user.try_borrow_mut_lamports()? += joiner_account_lamports;
            return Ok(());
        }

        // if the LP hasn't been launched yet this is all we can do
        if launch_data.flags[LaunchFlags::LPState as usize] != 2 {
            msg!("LP not yet set up cannot claim tokens");
            join_data.serialize(&mut &mut ctx.accounts.join_data.data.borrow_mut()[..])?;
            return Ok(());
        }
    }

    // if there were no losing tickets update the status
    join_data.ticket_status = TicketStatus::LosingRefunded;

    // if the LP hasn't been launched yet this is all we can do
    if launch_data.flags[LaunchFlags::LPState as usize] != 2 {
        msg!("LP not yet set up cannot claim tokens");
        join_data.serialize(&mut &mut ctx.accounts.join_data.data.borrow_mut()[..])?;
        return Ok(());
    }

    // now handle the winning tickets
    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.user,
        ctx.accounts.base_token_mint,
        ctx.accounts.user_base,
        ctx.accounts.base_token_program,
    )?;

    let total_token_amount = launch_data.total_supply * u64::pow(10, listing.decimals as u32);

    let total_raffle_token_amount =
        ((total_token_amount as f64) * ((launch_data.distribution[Distribution::Raffle as usize] as f64) / (100 as f64))) as u64;

    let one_ticket_tokens = total_raffle_token_amount / (launch_data.num_mints as u64);
    let winning_ticket_amount = match launch_data.launch_meta {
        LaunchMeta::Raffle(_) => (winning_tickets as u64) * one_ticket_tokens,
        LaunchMeta::FCFS(_) => (winning_tickets as u64) * one_ticket_tokens,
        LaunchMeta::IDO(props) => {
            let user_percent: f64 = join_data.num_tickets as f64 / launch_data.tickets_sold as f64;
            let mut total_percent: f64 = props.token_fraction_distributed + user_percent;
            if total_percent > 1.0 {
                total_percent = 1.0;
            }

            let current_distributed = props.tokens_distributed;

            let new_distributed: u64 = (total_percent * (total_raffle_token_amount as f64) + 0.5) as u64;

            let updated_ido: LaunchMeta = LaunchMeta::IDO(IDO {
                token_fraction_distributed: total_percent,
                tokens_distributed: new_distributed,
            });

            launch_data.launch_meta = updated_ido;

            new_distributed - current_distributed
        }
    };

    msg!("Transferring tokens:  {} {}", one_ticket_tokens, winning_ticket_amount);

    utils::transfer_tokens(
        base_2022,
        winning_ticket_amount,
        ctx.accounts.cook_base_token,
        ctx.accounts.base_token_mint,
        ctx.accounts.user_base,
        ctx.accounts.cook_pda,
        ctx.accounts.base_token_program,
        pda_sol_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        listing.decimals,
        &transfer_hook_accounts,
    )?;

    join_data.ticket_status = TicketStatus::WinningClaimed;

    launch_data.serialize(&mut &mut ctx.accounts.launch_data.data.borrow_mut()[..])?;
    join_data.serialize(&mut &mut ctx.accounts.join_data.data.borrow_mut()[..])?;

    let joiner_account_lamports = **ctx.accounts.join_data.try_borrow_lamports()?;
    msg!("close joiner account for {} lamports", joiner_account_lamports);
    **ctx.accounts.join_data.try_borrow_mut_lamports()? -= joiner_account_lamports;
    **ctx.accounts.user.try_borrow_mut_lamports()? += joiner_account_lamports;

    Ok(())
}
