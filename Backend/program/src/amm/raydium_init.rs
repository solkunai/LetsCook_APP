use borsh::{BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::AccountInfo,
    clock::Clock,
    entrypoint::ProgramResult,
    instruction, msg,
    native_token::LAMPORTS_PER_SOL,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    sysvar::Sysvar,
};

use crate::{
    accounts,
    amm::{get_amm_seeds, AMMPlugin, AMM},
    instruction::accounts::CreateRaydiumAccounts,
    launch,
    state::NETWORK,
};
use crate::{instruction::InitRaydiumArgs, utils};
use crate::{launch::Listing, state};

pub fn raydium_init<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: InitRaydiumArgs) -> ProgramResult {
    msg!("in create amm, getting accounts");

    let ctx: crate::instruction::accounts::Context<CreateRaydiumAccounts> = CreateRaydiumAccounts::context(accounts)?;

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let listing = Listing::try_from_slice(&ctx.accounts.listing.data.borrow()[..])?;
    let _listing_bump_seed =
        accounts::check_program_data_account(ctx.accounts.listing, program_id, vec![&listing.mint.to_bytes(), b"Listing"]).unwrap();

    let mut launch_data = launch::LaunchData::try_from_slice(&ctx.accounts.launch_data.data.borrow()[..])?;

    let _launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.launch_data, program_id, vec![launch_data.page_name.as_bytes(), b"Launch"]).unwrap();

    let base_is_zero = if ctx.accounts.mint_0.key.eq(&listing.mint) { true } else { false };

    let _user_data_bump =
        accounts::check_program_data_account(ctx.accounts.user_data, program_id, vec![&ctx.accounts.user.key.to_bytes(), b"User"]).unwrap();

    let temp_account_bump =
        accounts::check_program_data_account(ctx.accounts.temp_wsol, program_id, vec![&ctx.accounts.user.key.to_bytes(), b"Temp"]).unwrap();

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
    get_amm_seeds(
        if base_is_zero {
            *ctx.accounts.mint_0.key
        } else {
            *ctx.accounts.mint_1.key
        },
        if base_is_zero {
            *ctx.accounts.mint_1.key
        } else {
            *ctx.accounts.mint_0.key
        },
        &mut amm_seed_keys,
    );

    let _amm_bump_seed = accounts::check_program_data_account(
        ctx.accounts.cook_amm,
        program_id,
        vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), b"RaydiumCPMM"],
    )
    .unwrap();
    let _trade_to_earn_bump = accounts::check_program_data_account(
        ctx.accounts.trade_to_earn,
        program_id,
        vec![&ctx.accounts.cook_amm.key.to_bytes(), b"TradeToEarn"],
    )
    .unwrap();

    let mut user_data = state::UserData::try_from_slice(&ctx.accounts.user_data.data.borrow()[..])?;

    if *ctx.accounts.team.key != launch_data.keys[launch::LaunchKeys::TeamWallet as usize] {
        msg!("Team wallet mismatch");
        return Err(ProgramError::InvalidAccountData);
    }

    if *ctx.accounts.user.key != launch_data.keys[launch::LaunchKeys::Seller as usize] {
        msg!("Only launch creator can create AMM");
        return Err(ProgramError::InvalidAccountData);
    }

    if launch_data.flags[launch::LaunchFlags::LPState as usize] == 2 {
        msg!("AMM already created");
        return Err(ProgramError::InvalidAccountData);
    }

    if launch_data.flags[launch::LaunchFlags::LaunchFailed as usize] == 1 {
        msg!("Launch has failed, cannot create AMM");
        return Err(ProgramError::InvalidAccountData);
    }

    accounts::check_raydium_key(ctx.accounts.raydium_program)?;

    let starting_balance = **ctx.accounts.pda.try_borrow_lamports()?;
    msg!("have {}", utils::to_sol(starting_balance));

    msg!("transfer wsol for raydium");
    // first transfer 0.15 SOL from the launch wsol account to cover the cost of creating the AMM
    let raydium_cost = (0.15 * LAMPORTS_PER_SOL as f64) as u64;
    if base_is_zero {
        utils::unwrap_wsol(
            raydium_cost,
            ctx.accounts.user,
            ctx.accounts.pda,
            ctx.accounts.temp_wsol,
            ctx.accounts.pda,
            ctx.accounts.user_1,
            ctx.accounts.mint_1,
            ctx.accounts.token_program_1,
            pda_sol_bump_seed,
            &vec![&accounts::SOL_SEED.to_le_bytes()],
            temp_account_bump,
        )?;
    } else {
        utils::unwrap_wsol(
            raydium_cost,
            ctx.accounts.user,
            ctx.accounts.pda,
            ctx.accounts.temp_wsol,
            ctx.accounts.pda,
            ctx.accounts.user_0,
            ctx.accounts.mint_0,
            ctx.accounts.token_program_0,
            pda_sol_bump_seed,
            &vec![&accounts::SOL_SEED.to_le_bytes()],
            temp_account_bump,
        )?;
    }
    let account_metas = vec![
        instruction::AccountMeta::new(*ctx.accounts.pda.key, true),
        instruction::AccountMeta::new_readonly(*ctx.accounts.amm_config.key, false),
        instruction::AccountMeta::new(*ctx.accounts.authority.key, false),
        instruction::AccountMeta::new(*ctx.accounts.state.key, false),
        instruction::AccountMeta::new(*ctx.accounts.mint_0.key, false),
        instruction::AccountMeta::new(*ctx.accounts.mint_1.key, false),
        instruction::AccountMeta::new(*ctx.accounts.lp_mint.key, false),
        instruction::AccountMeta::new(*ctx.accounts.user_0.key, false),
        instruction::AccountMeta::new(*ctx.accounts.user_1.key, false),
        instruction::AccountMeta::new(*ctx.accounts.user_lp.key, false),
        instruction::AccountMeta::new(*ctx.accounts.amm_0.key, false),
        instruction::AccountMeta::new(*ctx.accounts.amm_1.key, false),
        instruction::AccountMeta::new(*ctx.accounts.fees.key, false),
        instruction::AccountMeta::new(*ctx.accounts.observation_state.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.lp_token_program.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.token_program_0.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.token_program_1.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.associated.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.system_program.key, false),
        instruction::AccountMeta::new_readonly(*ctx.accounts.rent_program.key, false),
    ];

    let quote_amount: u64 = launch_data.ticket_price * launch_data.num_mints as u64;
    let total_token_amount = launch_data.total_supply * u64::pow(10, listing.decimals as u32);

    let base_amount = ((total_token_amount as f64) * ((launch_data.distribution[launch::Distribution::LP as usize] as f64) / (100 as f64))) as u64;

    msg!("{} {}", quote_amount, base_amount);

    let amount_0 = if base_is_zero { base_amount } else { quote_amount - raydium_cost };
    let amount_1 = if base_is_zero { quote_amount - raydium_cost } else { base_amount };

    let new_args = state::InitAMM {
        descriminator: args.descriminator,
        amount_0: amount_0,
        amount_1: amount_1,
        open_time: args.open_time,
    };

    let mut instr_in_bytes: Vec<u8> = Vec::new();
    new_args.serialize(&mut instr_in_bytes)?;

    let instruction = instruction::Instruction::new_with_bytes(*ctx.accounts.raydium_program.key, &instr_in_bytes, account_metas);

    // setting up an AMM costs about 1 SOL, so transfer that, and we can then send the residual back to the user

    let user_deposit = if NETWORK == state::Network::Devnet {
        ((LAMPORTS_PER_SOL as f64) * 0.9) as u64
    } else {
        ((LAMPORTS_PER_SOL as f64) * 0.05) as u64
    };
    invoke(
        &system_instruction::transfer(ctx.accounts.user.key, ctx.accounts.pda.key, user_deposit),
        &[ctx.accounts.user.clone(), ctx.accounts.pda.clone()],
    )?;

    msg!("call into raydium program");
    invoke_signed(
        &instruction,
        &[
            ctx.accounts.pda.clone(),
            ctx.accounts.amm_config.clone(),
            ctx.accounts.authority.clone(),
            ctx.accounts.state.clone(),
            ctx.accounts.mint_0.clone(),
            ctx.accounts.mint_1.clone(),
            ctx.accounts.lp_mint.clone(),
            ctx.accounts.user_0.clone(),
            ctx.accounts.user_1.clone(),
            ctx.accounts.user_lp.clone(),
            ctx.accounts.amm_0.clone(),
            ctx.accounts.amm_1.clone(),
            ctx.accounts.fees.clone(),
            ctx.accounts.observation_state.clone(),
            ctx.accounts.lp_token_program.clone(),
            ctx.accounts.token_program_0.clone(),
            ctx.accounts.token_program_1.clone(),
            ctx.accounts.associated.clone(),
            ctx.accounts.system_program.clone(),
            ctx.accounts.rent_program.clone(),
        ],
        &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]],
    )?;

    let ending_balance = **ctx.accounts.pda.try_borrow_lamports()?;

    msg!("now have {}", utils::to_sol(ending_balance));

    let delta = ending_balance - starting_balance;

    invoke_signed(
        &system_instruction::transfer(ctx.accounts.pda.key, ctx.accounts.user.key, delta),
        &[ctx.accounts.user.clone(), ctx.accounts.pda.clone()],
        &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]],
    )?;

    launch_data.flags[launch::LaunchFlags::LPState as usize] = 2;
    user_data.total_points += 2000;

    let base_mint_account_info = if base_is_zero {
        ctx.accounts.mint_0.clone()
    } else {
        ctx.accounts.mint_1.clone()
    };

    let base_token_program_info = if base_is_zero {
        ctx.accounts.token_program_0.clone()
    } else {
        ctx.accounts.token_program_1.clone()
    };

    let base_token_account_info = if base_is_zero {
        ctx.accounts.user_0.clone()
    } else {
        ctx.accounts.user_1.clone()
    };

    // create the ATA, this will belong to the team wallet account

    utils::create_ata(
        ctx.accounts.user,
        ctx.accounts.team,
        &base_mint_account_info,
        ctx.accounts.team_token,
        &base_token_program_info,
    )?;

    let user_token_frac: f64 = launch::get_user_dist(launch_data.distribution.clone());

    let total_token_amount: f64 = (launch_data.total_supply * u64::pow(10, listing.decimals as u32)) as f64;

    let user_token_amount: u64 = (user_token_frac * total_token_amount) as u64;
    utils::transfer_tokens(
        true,
        user_token_amount,
        &base_token_account_info,
        &base_mint_account_info,
        ctx.accounts.team_token,
        ctx.accounts.pda,
        &base_token_program_info,
        pda_sol_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        listing.decimals,
        &vec![],
    )?;

    let clock = Clock::get()?;

    launch_data.last_interaction = clock.unix_timestamp;

    launch_data.serialize(&mut &mut ctx.accounts.launch_data.data.borrow_mut()[..])?;
    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    // now sort out the trade to earn if we need to
    let mut amm_data = AMM::try_from_slice(&ctx.accounts.cook_amm.data.borrow()[..])?;
    amm_data.start_time = clock.unix_timestamp as u64;

    // check if we have the trad2earn plugin
    if amm_data.plugins.len() > 0 {
        match amm_data.plugins[0] {
            AMMPlugin::TradeToEarn(ref mut args) => {
                let rewards_token_frac: f64 = launch_data.distribution[launch::Distribution::MMRewards as usize] as f64 / 100.0;

                let rewards_amount: u64 = (rewards_token_frac * total_token_amount) as u64;
                utils::transfer_tokens(
                    true,
                    rewards_amount,
                    &base_token_account_info,
                    &base_mint_account_info,
                    ctx.accounts.trade_to_earn,
                    ctx.accounts.pda,
                    &base_token_program_info,
                    pda_sol_bump_seed,
                    &vec![&accounts::SOL_SEED.to_le_bytes()],
                    listing.decimals,
                    &vec![],
                )?;

                let actual_amount = utils::get_token_balance(ctx.accounts.trade_to_earn);
                args.total_tokens = actual_amount;
                args.first_reward_date = ((clock.unix_timestamp as u64) / (24 * 60 * 60)) as u32;
                amm_data.plugins[0] = AMMPlugin::TradeToEarn(*args);
            }
            _ => {}
        }
    }
    amm_data.serialize(&mut &mut ctx.accounts.cook_amm.data.borrow_mut()[..])?;

    Ok(())
}
