use borsh::{BorshDeserialize, BorshSerialize};

use mpl_core::instructions::{CreateV1CpiBuilder, TransferV1CpiBuilder};
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};
use spl_token_2022::extension::{BaseStateWithExtensions, StateWithExtensions};

use crate::hybrid::{
    get_collection_plugin_map, CollectionData, CollectionKeys, CollectionMeta, CollectionPlugin, CollectionPluginType, NFTAssignment,
};
use crate::{accounts, instruction::accounts::MintRandomNFTAccounts, utils::mpl_compat::convert_mpl_error};

use crate::utils;

fn mint_random_collection_nft<'a>(
    user_account_info: &'a AccountInfo<'a>,
    sol_account_info: &'a AccountInfo<'a>,
    pda_sol_bump_seed: u8,
    system_program_account_info: &'a AccountInfo<'a>,
    core_account_info: &'a AccountInfo<'a>,
    nft_mint_account_info: &'a AccountInfo<'a>,
    collection_mint_account_info: &'a AccountInfo<'a>,
    nft_name: String,
    // collection accounts
    nft_meta: String, // collection metadata details
    randoms: [f64; 25],
) -> ProgramResult {
    msg!("create collection asset");
    unsafe {
        let _create_cpi = CreateV1CpiBuilder::new(unsafe { std::mem::transmute(core_account_info) })
            .authority(Some(unsafe { std::mem::transmute(sol_account_info) }))
            .asset(unsafe { std::mem::transmute(nft_mint_account_info) })
            .collection(Some(unsafe { std::mem::transmute(collection_mint_account_info) }))
            .payer(unsafe { std::mem::transmute(user_account_info) })
            .owner(Some(unsafe { std::mem::transmute(sol_account_info) }))
            .data_state(mpl_core::types::DataState::AccountState)
            .name(nft_name.to_string())
            .uri(nft_meta.to_string())
            .system_program(unsafe { std::mem::transmute(system_program_account_info) })
            .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]])
            .map_err(|e| convert_mpl_error(e))?;
    }

    // see if we need to generate some attributes
    let collection = mpl_core::Collection::from_bytes(&collection_mint_account_info.data.borrow()[..])?;

    let attributes_plugin = collection.plugin_list.attributes;

    if attributes_plugin.is_some() {
        let collection_attributes = attributes_plugin.unwrap().attributes.attribute_list;
        let mut attribute_list: Vec<mpl_core::types::Attribute> = Vec::new();

        let n_attributes = collection_attributes.len() / 3;
        for i in 0..n_attributes {
            let min = collection_attributes[i * 3 + 1].value.parse::<f64>().unwrap();
            let max = collection_attributes[i * 3 + 2].value.parse::<f64>().unwrap();
            let value = ((max - min) * randoms[2 + i] + min) as u32;

            attribute_list.push(mpl_core::types::Attribute {
                key: collection_attributes[i * 3].value.to_string(),
                value: value.to_string(),
            });
        }

        unsafe {
            mpl_core::instructions::AddPluginV1CpiBuilder::new(unsafe { std::mem::transmute(core_account_info) })
                .collection(Some(unsafe { std::mem::transmute(collection_mint_account_info) }))
                .asset(unsafe { std::mem::transmute(nft_mint_account_info) })
                .payer(unsafe { std::mem::transmute(user_account_info) })
                .authority(Some(unsafe { std::mem::transmute(sol_account_info) }))
                .plugin(mpl_core::types::Plugin::Attributes(mpl_core::types::Attributes {
                    attribute_list: attribute_list,
                }))
                .system_program(unsafe { std::mem::transmute(system_program_account_info) })
                .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]])
                .map_err(|e| convert_mpl_error(e))?;
        }
    }
    Ok(())
}

pub fn mint_random<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    msg!("in mint random");
    let ctx: crate::instruction::accounts::Context<MintRandomNFTAccounts> = MintRandomNFTAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }

    let _assignment_bump_seed = accounts::check_program_data_account(
        ctx.accounts.assignment,
        program_id,
        vec![&ctx.accounts.user.key.to_bytes(), &ctx.accounts.collection.key.to_bytes(), b"assignment"],
    )
    .unwrap();

    msg!("get collection data");
    let collection_data = Box::<CollectionData>::try_from_slice(&ctx.accounts.collection_data.data.borrow()[..])?;

    let _collection_bump_seed = accounts::check_program_data_account(
        ctx.accounts.collection_data,
        program_id,
        vec![collection_data.page_name.as_bytes(), b"Collection"],
    )
    .unwrap();

    if ctx.accounts.collection.key != &collection_data.keys[CollectionKeys::CollectionAddress as usize] {
        msg!("collection mint does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    accounts::check_token_account(
        ctx.accounts.user,
        ctx.accounts.token_mint,
        ctx.accounts.user_token,
        ctx.accounts.token_program,
    )?;

    accounts::check_token_account(
        ctx.accounts.cook_pda,
        ctx.accounts.token_mint,
        ctx.accounts.cook_token,
        ctx.accounts.token_program,
    )?;

    if ctx.accounts.team.key != &collection_data.keys[CollectionKeys::TeamWallet as usize] {
        msg!("team wallet does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    accounts::check_token_account(
        ctx.accounts.team,
        ctx.accounts.token_mint,
        ctx.accounts.team_token,
        ctx.accounts.token_program,
    )?;

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;
    accounts::check_core_key(ctx.accounts.core_program)?;
    let is_2022 = accounts::check_token_program_key(ctx.accounts.token_program)?;

    let mut assignment_data = NFTAssignment::try_from_slice(&ctx.accounts.assignment.data.borrow()[..])?;

    if ctx.accounts.orao_random.key != &assignment_data.random_address {
        msg!(
            "random address does not match {} {}",
            ctx.accounts.orao_random.key,
            assignment_data.random_address
        );
        return Err(ProgramError::InvalidAccountData);
    }

    if ctx.accounts.system_program.key == &assignment_data.random_address {
        msg!("have no random data");
        return Err(ProgramError::InvalidAccountData);
    }

    if assignment_data.status > 0 {
        msg!("already used this random data");
        return Err(ProgramError::InvalidAccountData);
    }

    // otherwise we try and mint the nft
    // if this is mint only then we need to transfer them to the team or burn them if there was no team account
    let plugin_map = get_collection_plugin_map(collection_data.plugins.clone());
    // check if we are mint only
    let mint_only_option = plugin_map.get(&CollectionPluginType::MintOnly);

    // if this is mint only, or the swap fee is 100% then transfer the amount to the team
    if mint_only_option.is_some() || collection_data.swap_fee == 10000 {
        let mint_data = ctx.accounts.token_mint.data.borrow();
        let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;
        let recieved_amount = if let Ok(transfer_fee_config) = mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>() {
            let fee = transfer_fee_config
                .calculate_epoch_fee(Clock::get()?.epoch, collection_data.swap_price)
                .ok_or(ProgramError::InvalidArgument)?;
            collection_data.swap_price.saturating_sub(fee)
        } else {
            collection_data.swap_price
        };
        if ctx.accounts.team.key != program_id {
            utils::transfer_tokens(
                is_2022,
                recieved_amount,
                ctx.accounts.cook_token,
                ctx.accounts.token_mint,
                ctx.accounts.team_token,
                ctx.accounts.cook_pda,
                ctx.accounts.token_program,
                pda_sol_bump_seed,
                &vec![&accounts::SOL_SEED.to_le_bytes()],
                collection_data.token_decimals,
                &transfer_hook_accounts,
            )?;
        } else {
            utils::burn(
                recieved_amount,
                ctx.accounts.token_program,
                ctx.accounts.token_mint,
                ctx.accounts.cook_token,
                ctx.accounts.cook_pda,
                pda_sol_bump_seed,
                &vec![&accounts::SOL_SEED.to_le_bytes()],
            )?;
        }
    }

    let win_roll = utils::generate_random_f64(u64::try_from_slice(&ctx.accounts.orao_random.data.borrow()[40..48])?);
    let which_roll = utils::generate_random_f64(u64::try_from_slice(&ctx.accounts.orao_random.data.borrow()[48..56])?);
    let mut seed = u64::try_from_slice(&ctx.accounts.orao_random.data.borrow()[56..64])?;

    msg!("rolls {} {}", win_roll, which_roll);

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

    let slot = Clock::get()?.slot as u32;

    if assignment_data.num_interactions == slot {
        msg!("Claim called multiple times on the same slot");
        return Err(ProgramError::InvalidAccountData);
    }

    assignment_data.num_interactions = slot;
    assignment_data.random_address = *ctx.accounts.system_program.key;

    let plugin_map = get_collection_plugin_map(collection_data.plugins);

    let chosen_idx = ((collection_data.total_supply as f64) * randoms[0]) as u32;

    let nft_name: String;
    let nft_meta: String;
    match collection_data.collection_meta {
        CollectionMeta::RandomFixedSupply(ref _args) => {
            msg!("Incorrect collection type for mint random");
            return Err(ProgramError::InvalidAccountData);
        }
        CollectionMeta::RandomUnlimited(_) => {
            let plugin = plugin_map.get(&CollectionPluginType::MintProbability);
            let mut mint_prob = 100;
            if plugin.is_some() {
                mint_prob = match plugin.unwrap() {
                    CollectionPlugin::MintProbability(args) => args.mint_prob,
                    _ => 100,
                }
            };

            msg!("Have rolls {} {} {}", chosen_idx, randoms[1] * 100.0, mint_prob);
            if (randoms[1] * 100.0) as u16 > mint_prob {
                msg!("failed to win nft");

                assignment_data.status = 1;
                assignment_data.nft_address = *ctx.accounts.system_program.key;
                assignment_data.nft_index = 0;
                assignment_data.serialize(&mut &mut ctx.accounts.assignment.data.borrow_mut()[..])?;

                return Ok(());
            }

            let collection = mpl_core::Collection::from_bytes(&ctx.accounts.collection.data.borrow()[..])?;

            let collection_size = collection.base.num_minted;
            nft_name = format!("{} #{:04}", collection_data.nft_name, collection_size + 1);
            nft_meta = format!("{}{}.json", collection_data.nft_meta_url, chosen_idx);

            assignment_data.nft_address = *ctx.accounts.asset.key;
            assignment_data.nft_index = chosen_idx;
            assignment_data.status = 2;
            assignment_data.serialize(&mut &mut ctx.accounts.assignment.data.borrow_mut()[..])?;
        }
    }

    // mint the token
    mint_random_collection_nft(
        ctx.accounts.user,
        ctx.accounts.cook_pda,
        pda_sol_bump_seed,
        ctx.accounts.system_program,
        ctx.accounts.core_program,
        ctx.accounts.asset,
        ctx.accounts.collection,
        nft_name,
        nft_meta,
        randoms,
    )?;

    unsafe {
        let _transfer = TransferV1CpiBuilder::new(unsafe { std::mem::transmute(ctx.accounts.core_program) })
            .asset(unsafe { std::mem::transmute(ctx.accounts.asset) })
            .authority(Some(unsafe { std::mem::transmute(ctx.accounts.cook_pda) }))
            .payer(unsafe { std::mem::transmute(ctx.accounts.user) })
            .new_owner(unsafe { std::mem::transmute(ctx.accounts.user) })
            .collection(Some(unsafe { std::mem::transmute(ctx.accounts.collection) }))
            .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]])
            .map_err(|e| convert_mpl_error(e))?;
    }

    Ok(())
}
