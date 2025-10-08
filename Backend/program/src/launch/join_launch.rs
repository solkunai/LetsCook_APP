use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use sha2::{Digest, Sha256};
use solana_program::{
    account_info::AccountInfo,
    clock::Clock,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    sysvar::Sysvar,
};

use crate::{
    accounts,
    instruction::{accounts::BuyTicketsAccounts, JoinArgs},
    launch::{get_launch_plugin_map, JoinData, LaunchData, LaunchKeys, LaunchMeta, LaunchPlugin, LaunchPluginType, Listing, TicketStatus},
    state::{self, FEE_AMOUNT},
    utils,
};

pub fn join_launch<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: JoinArgs) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<BuyTicketsAccounts> = BuyTicketsAccounts::context(accounts)?;

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // check the game account is the same as is on chain
    let listing = Listing::try_from_slice(&ctx.accounts.listing.data.borrow()[..])?;
    let mut launch_data = LaunchData::try_from_slice(&ctx.accounts.launch_data.data.borrow()[..])?;

    msg!("check player join account");
    let user_join_bump = accounts::check_program_data_account(
        ctx.accounts.join_data,
        program_id,
        vec![&ctx.accounts.user.key.to_bytes(), &launch_data.page_name.as_bytes(), b"Joiner"],
    )
    .unwrap();

    msg!("check launch account");
    let _launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.launch_data, program_id, vec![launch_data.page_name.as_bytes(), b"Launch"]).unwrap();

    let _listing_bump_seed =
        accounts::check_program_data_account(ctx.accounts.listing, program_id, vec![&listing.mint.to_bytes(), b"Listing"]).unwrap();

    if *ctx.accounts.launch_quote.key != launch_data.keys[LaunchKeys::WSOLAddress as usize] {
        msg!("WSOL account does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    let random_bump = accounts::check_program_data_account(
        ctx.accounts.orao_random,
        ctx.accounts.orao_program.key,
        vec![b"orao-vrf-randomness-request", &args.seed],
    )
    .unwrap();

    //accounts::check_fees_account(fees_account_info).unwrap();
    accounts::check_system_program_key(ctx.accounts.system_program)?;
    let _quote_2022 = accounts::check_token_program_key(ctx.accounts.quote_token_program)?;

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    // perform other checks
    // joiner can't be the seller
    if ctx.accounts.user.key == &launch_data.keys[LaunchKeys::Seller as usize] {
        return Err(ProgramError::InvalidAccountData);
    }

    let clock = Clock::get()?;

    msg!("dates {} {} {}", launch_data.launch_date, launch_data.end_date, clock.unix_timestamp);

    // can only join a launch if it is after launch but before end
    if clock.unix_timestamp < (launch_data.launch_date / 1000) as i64 {
        msg!("Launch not yet started, cannot join");
        return Err(ProgramError::InvalidAccountData);
    }

    if clock.unix_timestamp > (launch_data.end_date / 1000) as i64 {
        msg!("Launch already ended, cannot join");
        return Err(ProgramError::InvalidAccountData);
    }

    utils::create_user_data(ctx.accounts.user, ctx.accounts.user_data, program_id)?;

    let mut user_data = state::UserData::try_from_slice(&ctx.accounts.user_data.data.borrow()[..])?;

    // check if this is a FCFS auction which will limit what they can get

    let fcfs = match launch_data.launch_meta {
        LaunchMeta::FCFS(_) => true,
        _ => false,
    };

    if fcfs && launch_data.tickets_sold >= launch_data.num_mints {
        msg!("FCFS launch is over");
        return Err(ProgramError::InvalidAccountData);
    }

    // crate the join account if we need to
    if **ctx.accounts.join_data.try_borrow_lamports()? == 0 {
        let temp: JoinData = JoinData {
            account_type: state::AccountType::Join,
            page_name: launch_data.page_name.to_string(),
            joiner_key: *ctx.accounts.user.key,
            ticket_status: TicketStatus::Available,
            last_slot: 0,
            num_tickets: 0,
            num_tickets_checked: 0,
            num_winning_tickets: 0,
            random_address: *ctx.accounts.orao_random.key,
        };

        utils::create_program_account(
            ctx.accounts.user,
            ctx.accounts.join_data,
            program_id,
            user_join_bump,
            to_vec(&temp).unwrap().len(),
            vec![&ctx.accounts.user.key.to_bytes(), &launch_data.page_name.as_bytes(), b"Joiner"],
        )?;

        msg!("init join data");
        temp.serialize(&mut &mut ctx.accounts.join_data.data.borrow_mut()[..])?;
    }

    msg!("get old join data");
    let mut join_data = JoinData::try_from_slice(&ctx.accounts.join_data.data.borrow()[..])?;

    if join_data.account_type != state::AccountType::Join {
        join_data.account_type = state::AccountType::Join;
        join_data.page_name = launch_data.page_name.to_string();
        join_data.joiner_key = *ctx.accounts.user.key;
        join_data.ticket_status = TicketStatus::Available;
    }

    let slot = Clock::get()?.slot;
    if join_data.last_slot == slot {
        msg!("Buy Tickets called multiple times on the same slot");
        return Err(ProgramError::InvalidAccountData);
    }

    let max_tickets_per_wallet: u16 = 1000;
    if join_data.num_tickets >= max_tickets_per_wallet {
        msg!("Max tickets per wallet reached");
        return Err(ProgramError::InvalidAccountData);
    }

    let tickets_bought = match launch_data.launch_meta {
        LaunchMeta::Raffle(_) => {
            let max_raffle_tickets_per_wallet: u16 = 1000;
            u16::min(args.num_tickets, max_raffle_tickets_per_wallet.saturating_sub(join_data.num_tickets))
        }
        LaunchMeta::FCFS(_) => u16::min(args.num_tickets, launch_data.num_mints.saturating_sub(launch_data.tickets_sold) as u16),
        LaunchMeta::IDO(_) => {
            let max_ido_tickets_per_wallet: u16 = u64::min(50000, launch_data.total_supply) as u16;
            u16::min(args.num_tickets, max_ido_tickets_per_wallet.saturating_sub(join_data.num_tickets) as u16)
        }
    };

    join_data.last_slot = slot;
    join_data.num_tickets += tickets_bought;
    if fcfs {
        join_data.random_address = *ctx.accounts.system_program.key;
    } else {
        join_data.random_address = *ctx.accounts.orao_random.key;
    }
    join_data.serialize(&mut &mut ctx.accounts.join_data.data.borrow_mut()[..])?;

    // add points to the user
    user_data.total_points += 25 * tickets_bought as u32;
    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    // check if we are whitelisting
    let plugin_map = get_launch_plugin_map(launch_data.plugins.clone());
    let whitelist_option = plugin_map.get(&LaunchPluginType::WhiteListToken);

    if whitelist_option.is_some() {
        let whitelist_plugin = whitelist_option.unwrap();
        match whitelist_plugin {
            LaunchPlugin::WhiteListToken(whitelist) => {
                if *ctx.accounts.whitelist_mint.key != whitelist.key {
                    msg!("Incorrect whitelist mint");
                    return Err(ProgramError::InvalidAccountData);
                }
                utils::burn(
                    whitelist.quantity * tickets_bought as u64,
                    ctx.accounts.whitelist_token_program,
                    ctx.accounts.whitelist_mint,
                    ctx.accounts.whitelist_account,
                    ctx.accounts.user,
                    0,
                    &Vec::new(),
                )?;
            }
        }
    }

    // update the randomness
    let requires_randomness = match launch_data.launch_meta {
        LaunchMeta::Raffle(_) => true,
        LaunchMeta::FCFS(_) => false,
        LaunchMeta::IDO(_) => false,
    };
    if requires_randomness {
        // if we are on solana then use orao
        if state::NETWORK != state::Network::Eclipse {
            accounts::check_orao_key(ctx.accounts.orao_program)?;

            let account_metas = vec![
                AccountMeta::new(*ctx.accounts.user.key, true),
                AccountMeta::new(*ctx.accounts.orao_network.key, false),
                AccountMeta::new(*ctx.accounts.orao_treasury.key, false),
                AccountMeta::new(*ctx.accounts.orao_random.key, false),
                AccountMeta::new_readonly(*ctx.accounts.system_program.key, false),
            ];

            let new_args = state::OraoRequest {
                descriminator: [46, 101, 67, 11, 76, 137, 12, 173],
                seed: args.seed,
            };

            let mut instr_in_bytes: Vec<u8> = Vec::new();
            new_args.serialize(&mut instr_in_bytes)?;

            let instruction = Instruction::new_with_bytes(*ctx.accounts.orao_program.key, &instr_in_bytes, account_metas);

            invoke_signed(
                &instruction,
                &[
                    ctx.accounts.user.clone(),
                    ctx.accounts.orao_network.clone(),
                    ctx.accounts.orao_treasury.clone(),
                    ctx.accounts.orao_random.clone(),
                    ctx.accounts.system_program.clone(),
                ],
                &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]],
            )?;
        } else {
            if ctx.accounts.orao_program.key != program_id {
                msg!("incorrect orao program passed");
                return Err(ProgramError::InvalidAccountData);
            }
            // create the account
            utils::create_program_account(
                ctx.accounts.user,
                ctx.accounts.orao_random,
                program_id,
                random_bump,
                104,
                vec![b"orao-vrf-randomness-request", &args.seed],
            )?;

            let mut seed_values = state::SeedStruct { seed_prices: [0; 10] };
            seed_values.seed_prices[0] = u64::from_le_bytes(args.seed[0..8].try_into().unwrap());
            seed_values.seed_prices[1] = u64::from_le_bytes(args.seed[8..16].try_into().unwrap());
            seed_values.seed_prices[2] = u64::from_le_bytes(args.seed[16..24].try_into().unwrap());
            seed_values.seed_prices[3] = u64::from_le_bytes(args.seed[24..32].try_into().unwrap());
            seed_values.seed_prices[4] = Clock::get()?.slot;
            seed_values.seed_prices[5] = Clock::get()?.unix_timestamp as u64;

            seed_values.seed_prices[6] = u64::from_le_bytes(ctx.accounts.user.key.to_bytes()[..8].try_into().unwrap());
            seed_values.seed_prices[7] = u64::from_le_bytes(ctx.accounts.user.key.to_bytes()[8..16].try_into().unwrap());
            seed_values.seed_prices[8] = u64::from_le_bytes(ctx.accounts.user.key.to_bytes()[16..24].try_into().unwrap());
            seed_values.seed_prices[9] = u64::from_le_bytes(ctx.accounts.user.key.to_bytes()[24..32].try_into().unwrap());

            let vec_to_hash = unsafe { utils::any_as_u8_slice(&seed_values) };
            let hash = &(Sha256::new().chain_update(vec_to_hash).finalize()[..32]);
            let mut hash_array = [0u8; 104];
            hash_array[40..72].copy_from_slice(&hash[..32]);
            hash_array[72..104].copy_from_slice(&hash[..32]);

            hash_array.serialize(&mut &mut ctx.accounts.orao_random.data.borrow_mut()[..])?;
        }
    }
    msg!("transfer SOL {}", launch_data.ticket_price);

    // transfer the sol for the tickets
    let one_ticket_cost = launch_data.ticket_price;

    let ticket_cost = one_ticket_cost * (tickets_bought as u64);

    utils::wrap_sol(
        ticket_cost,
        ctx.accounts.user,
        ctx.accounts.launch_quote,
        ctx.accounts.quote_token_program,
    )?;

    msg!("transfer fees");

    invoke(
        &system_instruction::transfer(ctx.accounts.user.key, &ctx.accounts.fees.key, FEE_AMOUNT),
        &[ctx.accounts.user.clone(), ctx.accounts.fees.clone()],
    )?;

    launch_data.num_interactions += 1;
    launch_data.tickets_sold += tickets_bought as u32;

    if fcfs && launch_data.tickets_sold >= launch_data.num_mints {
        launch_data.end_date = (clock.unix_timestamp - 1) as u64;
    }
    launch_data.serialize(&mut &mut ctx.accounts.launch_data.data.borrow_mut()[..])?;

    Ok(())
}
