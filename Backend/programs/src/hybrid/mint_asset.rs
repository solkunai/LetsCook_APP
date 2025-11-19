use borsh::{BorshDeserialize, BorshSerialize};

use mpl_core::instructions::TransferV1CpiBuilder;
use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};
use spl_token_2022::extension::{BaseStateWithExtensions, StateWithExtensions};

use crate::hybrid::{get_collection_plugin_map, CollectionKeys, CollectionPluginType};
use crate::{
    accounts,
    hybrid::{CollectionData, CollectionMeta, CollectionPlugin, NFTAssignment},
    instruction::accounts::MintNFTAccounts,
    utils::mpl_compat::convert_mpl_error,
};

use crate::state;
use crate::utils::{self, mint_collection_nft, set_attributes};

pub fn mint_nft<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<MintNFTAccounts> = MintNFTAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }

    let mut collection_data = Box::<CollectionData>::try_from_slice(&ctx.accounts.collection_data.data.borrow()[..])?;

    let _collection_bump_seed = accounts::check_program_data_account(
        ctx.accounts.collection_data,
        program_id,
        vec![collection_data.page_name.as_bytes(), b"Collection"],
    )
    .unwrap();

    let _assignment_bump_seed = accounts::check_program_data_account(
        ctx.accounts.assignment,
        program_id,
        vec![&ctx.accounts.user.key.to_bytes(), &ctx.accounts.collection.key.to_bytes(), b"assignment"],
    )
    .unwrap();

    let mut assignment_data = NFTAssignment::try_from_slice(&ctx.accounts.assignment.data.borrow()[..])?;

    if ctx.accounts.orao_random.key != &assignment_data.random_address {
        msg!("random address does not match");
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

    // if at this point none are available, you've lost
    if collection_data.num_available == 0 {
        msg!("no nfts available");
        assignment_data.status = 1;
        assignment_data.nft_address = *ctx.accounts.system_program.key;
        assignment_data.nft_index = 0;
        assignment_data.serialize(&mut &mut ctx.accounts.assignment.data.borrow_mut()[..])?;

        // We need to transfer back the tokens the user paid

        let mint_data = ctx.accounts.token_mint.data.borrow();
        let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;
        let refund_amount = if let Ok(transfer_fee_config) = mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>() {
            let fee = transfer_fee_config
                .calculate_epoch_fee(Clock::get()?.epoch, collection_data.swap_price)
                .ok_or(ProgramError::InvalidArgument)?;
            collection_data.swap_price.saturating_sub(fee)
        } else {
            collection_data.swap_price
        };

        utils::transfer_tokens(
            is_2022,
            refund_amount,
            ctx.accounts.cook_token,
            ctx.accounts.token_mint,
            ctx.accounts.user_token,
            ctx.accounts.cook_pda,
            ctx.accounts.token_program,
            pda_sol_bump_seed,
            &vec![&accounts::SOL_SEED.to_le_bytes()],
            collection_data.token_decimals,
            &transfer_hook_accounts,
        )?;

        return Ok(());
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

    // check if we need to mint the nft
    if **ctx.accounts.asset.try_borrow_lamports()? != 0 {
        msg!("nft mint already exists");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut mint_prob = 100;
    {
        for i in 0..collection_data.plugins.len() {
            if CollectionPluginType::from(&collection_data.plugins[i]) == CollectionPluginType::MintProbability {
                mint_prob = match &collection_data.plugins[i] {
                    CollectionPlugin::MintProbability(ref args) => args.mint_prob,
                    _ => 100,
                }
            }
        }
    }

    match collection_data.collection_meta {
        CollectionMeta::RandomFixedSupply(ref mut args) => {
            if (win_roll * 100.0) as u16 > mint_prob {
                msg!("failed to win nft");

                assignment_data.status = 1;
                assignment_data.nft_address = *ctx.accounts.system_program.key;
                assignment_data.nft_index = 0;
                assignment_data.serialize(&mut &mut ctx.accounts.assignment.data.borrow_mut()[..])?;

                return Ok(());
            }

            let chosen_idx = ((collection_data.num_available as f64) * which_roll) as u32;
            msg!("searching for idx {} {}", chosen_idx, args.availability.len());

            let len = args.availability.len();
            let block_size = 8;
            // we first find the block that we need
            let mut block_idx: usize = 0;
            let mut current_idx: u32 = 0;
            for i in (len / 2)..len {
                if current_idx + args.availability[i] as u32 > chosen_idx {
                    break;
                }
                current_idx += args.availability[i] as u32;
                block_idx += 1;
            }

            msg!("have block {} remaining {}", block_idx, args.availability[block_idx + len / 2]);

            let mut nft_idx: u32 = (block_idx as u32) * block_size;

            let mut found: bool = false;
            // otherwise iterate through
            let mut idx: u8 = 1;
            for _j in 0..8 {
                msg!(
                    "checking block {} idx {} state {} result {} current {} nft {}",
                    block_idx,
                    idx,
                    args.availability[block_idx],
                    idx & args.availability[block_idx],
                    current_idx,
                    nft_idx
                );

                if idx & args.availability[block_idx] == 0 {
                    if chosen_idx == current_idx {
                        msg!(
                            "have the chosen idx {} {} {} {}",
                            block_idx,
                            args.availability[block_idx],
                            chosen_idx,
                            nft_idx
                        );
                        args.availability[block_idx] = args.availability[block_idx] | idx;

                        args.availability[block_idx + len / 2] -= 1;
                        msg!("new value {} ", args.availability[block_idx]);
                        found = true;
                        break;
                    }
                    current_idx += 1;
                }
                nft_idx += 1;
                idx *= 2;
            }

            if !found {
                msg!("no nft found");
                return Err(ProgramError::InvalidAccountData);
            }

            assignment_data.nft_address = *ctx.accounts.asset.key;
            assignment_data.nft_index = nft_idx;
            assignment_data.status = 2;

            collection_data.num_available -= 1;
            collection_data.serialize(&mut &mut ctx.accounts.collection_data.data.borrow_mut()[..])?;
        }
        CollectionMeta::RandomUnlimited(ref _args) => {
            msg!("Incorrect collection type for mint fixed");
            return Err(ProgramError::InvalidAccountData);
        }
    }

    let max_digits = collection_data.total_supply.to_string().len();
    let string_digits = max_digits - (assignment_data.nft_index + 1).to_string().len();
    let mut nft_name: String = collection_data.nft_name.to_string().to_owned();
    nft_name.push_str(&" #".to_string().to_owned());
    for _i in 0..string_digits {
        let zero_string: String = 0.to_string().to_owned();
        nft_name.push_str(&zero_string);
    }

    let this_nft_digits: String = (assignment_data.nft_index + 1).to_string().to_owned();
    nft_name.push_str(&this_nft_digits);

    let nft_meta = format!("{}{}.json", collection_data.nft_meta_url, assignment_data.nft_index);

    let collection_config = state::CollectionDetails {
        name: nft_name.to_string(),
        index: assignment_data.nft_index,
        uri: nft_meta.to_string(),
        pda: accounts::SOL_SEED,
    };

    let (_asset_account, asset_bump_seed) = Pubkey::find_program_address(
        &[
            &ctx.accounts.collection.key.to_bytes(),
            &assignment_data.nft_index.to_le_bytes(),
            b"Asset",
        ],
        &program_id,
    );

    // mint the token
    mint_collection_nft(
        ctx.accounts.user,
        ctx.accounts.cook_pda,
        asset_bump_seed,
        pda_sol_bump_seed,
        ctx.accounts.system_program,
        ctx.accounts.core_program,
        ctx.accounts.asset,
        ctx.accounts.collection,
        collection_config,
    )
    .unwrap();

    // otherwise just check the mint matched the one

    set_attributes(
        ctx.accounts.user,
        ctx.accounts.cook_pda,
        pda_sol_bump_seed,
        ctx.accounts.system_program,
        ctx.accounts.core_program,
        ctx.accounts.asset,
        ctx.accounts.collection,
        randoms,
        assignment_data.nft_index,
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

    // if not we just need to transfer it from the program

    assignment_data.serialize(&mut &mut ctx.accounts.assignment.data.borrow_mut()[..])?;

    Ok(())
}
