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
    hybrid::{
        get_collection_plugin_map, get_nft_assignment_data_size, CollectionData, CollectionKeys, CollectionPlugin, CollectionPluginType,
        NFTAssignment,
    },
    instruction::{accounts::ClaimNFTAccounts, ClaimNFTArgs},
    state::FEE_AMOUNT,
};

use crate::state;
use crate::utils;

pub fn claim_nft<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: ClaimNFTArgs) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<ClaimNFTAccounts> = ClaimNFTAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }

    msg!("get collection data");
    let collection_data = CollectionData::try_from_slice(&ctx.accounts.collection_data.data.borrow()[..])?;

    let _collection_bump_seed = accounts::check_program_data_account(
        ctx.accounts.collection_data,
        program_id,
        vec![collection_data.page_name.as_bytes(), b"Collection"],
    )
    .unwrap();

    let plugin_map = get_collection_plugin_map(collection_data.plugins.clone());

    if ctx.accounts.collection.key != &collection_data.keys[CollectionKeys::CollectionAddress as usize] {
        msg!("collection mint does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    if ctx.accounts.token_mint.key != &collection_data.keys[CollectionKeys::MintAddress as usize] {
        msg!("token mint does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    let assignment_bump_seed = accounts::check_program_data_account(
        ctx.accounts.assignment,
        program_id,
        vec![&ctx.accounts.user.key.to_bytes(), &ctx.accounts.collection.key.to_bytes(), b"assignment"],
    )
    .unwrap();

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let random_bump = accounts::check_program_data_account(
        ctx.accounts.orao_random,
        ctx.accounts.orao_program.key,
        vec![b"orao-vrf-randomness-request", &args.seed],
    )
    .unwrap();

    let expected_token_destination_owner = ctx.accounts.cook_pda;

    accounts::check_token_account(
        expected_token_destination_owner,
        ctx.accounts.token_mint,
        ctx.accounts.token_destination,
        ctx.accounts.token_program,
    )?;

    accounts::check_token_account(
        ctx.accounts.user,
        ctx.accounts.token_mint,
        ctx.accounts.user_token,
        ctx.accounts.token_program,
    )?;

    accounts::check_system_program_key(ctx.accounts.system_program)?;
    let is_2022 = accounts::check_token_program_key(ctx.accounts.token_program)?;

    if collection_data.num_available == 0 {
        msg!("No NFTs available");
        return Err(ProgramError::InvalidAccountData);
    }

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
    }
    // otherwise we just write some randomness to the account ourselves
    else {
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

    msg!("get user data");
    // check if this person has a player account
    utils::create_user_data(ctx.accounts.user, ctx.accounts.user_data, program_id)?;

    let mut user_data = state::UserData::try_from_slice(&ctx.accounts.user_data.data.borrow()[..])?;

    user_data.total_points += 2;

    // check if we need to extend for achievements
    if user_data.stats.values.len() < state::Achievement32::LENGTH as usize {
        for _ in user_data.stats.values.len()..state::Achievement32::LENGTH as usize {
            user_data.stats.values.push(0);
        }

        utils::check_for_realloc(
            ctx.accounts.user_data,
            ctx.accounts.user,
            ctx.accounts.user_data.data_len(),
            to_vec(&user_data).unwrap().len(),
        )?;
    }

    user_data.stats.values[state::Achievement32::NumMints as usize] += 1;

    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    // create the account if required
    utils::create_program_account(
        ctx.accounts.user,
        ctx.accounts.assignment,
        program_id,
        assignment_bump_seed,
        get_nft_assignment_data_size(),
        vec![&ctx.accounts.user.key.to_bytes(), &ctx.accounts.collection.key.to_bytes(), b"assignment"],
    )?;

    // check if we need to reallocate it
    utils::check_for_realloc(
        ctx.accounts.assignment,
        ctx.accounts.user,
        ctx.accounts.assignment.data_len(),
        get_nft_assignment_data_size(),
    )?;

    let mut assignment_data = NFTAssignment::try_from_slice(&ctx.accounts.assignment.data.borrow()[..])?;

    if assignment_data.account_type != state::AccountType::NFTAssignment {
        assignment_data.account_type = state::AccountType::NFTAssignment;
    }

    if assignment_data.random_address != *ctx.accounts.system_program.key {
        msg!("cannot claim twice without minting");
        return Err(ProgramError::InvalidAccountData);
    }

    utils::transfer_tokens(
        is_2022,
        collection_data.swap_price,
        ctx.accounts.user_token,
        ctx.accounts.token_mint,
        ctx.accounts.token_destination,
        ctx.accounts.user,
        ctx.accounts.token_program,
        pda_sol_bump_seed,
        &vec![&accounts::SOL_SEED.to_le_bytes()],
        collection_data.token_decimals,
        &transfer_hook_accounts,
    )?;

    invoke(
        &system_instruction::transfer(ctx.accounts.user.key, &ctx.accounts.cook_fees.key, FEE_AMOUNT),
        &[ctx.accounts.user.clone(), ctx.accounts.cook_fees.clone()],
    )?;

    // check if we are whitelisting
    let whitelist_option = plugin_map.get(&CollectionPluginType::WhiteListToken);

    if whitelist_option.is_some() {
        let whitelist_plugin = whitelist_option.unwrap();

        match whitelist_plugin {
            CollectionPlugin::WhiteListToken(whitelist) => {
                // check the launch/end dates are sane
                let clock = Clock::get()?;
                if whitelist.phase_end == 0 || (whitelist.phase_end > 0 && (clock.unix_timestamp as u64) < whitelist.phase_end / 1000) {
                    if *ctx.accounts.whitelist_mint.unwrap().key != whitelist.key {
                        msg!("Incorrect whitelist mint");
                        return Err(ProgramError::InvalidAccountData);
                    }
                    utils::burn(
                        whitelist.quantity as u64,
                        ctx.accounts.whitelist_token_program.unwrap(),
                        ctx.accounts.whitelist_mint.unwrap(),
                        ctx.accounts.whitelist_account.unwrap(),
                        ctx.accounts.user,
                        0,
                        &Vec::new(),
                    )?;
                }
            }
            _ => {
                msg!("Incorrect plugin type");
                return Err(ProgramError::InvalidAccountData);
            }
        }
    }

    let slot = Clock::get()?.slot as u32;

    if assignment_data.num_interactions == slot {
        msg!("Claim called multiple times on the same slot");
        return Err(ProgramError::InvalidAccountData);
    }

    assignment_data.num_interactions = slot;
    assignment_data.random_address = *ctx.accounts.orao_random.key;
    assignment_data.nft_address = *ctx.accounts.system_program.key;
    assignment_data.status = 0;
    assignment_data.nft_index = 0;

    assignment_data.serialize(&mut &mut ctx.accounts.assignment.data.borrow_mut()[..])?;

    Ok(())
}
