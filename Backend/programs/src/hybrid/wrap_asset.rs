use borsh::{to_vec, BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};
use spl_token_2022::extension::{BaseStateWithExtensions, StateWithExtensions};

use crate::hybrid::{get_collection_plugin_map, CollectionData, CollectionPluginType};
use crate::{
    accounts,
    hybrid::{CollectionKeys, CollectionMeta},
    instruction::accounts::WrapNFTAccounts,
    utils::mpl_compat::convert_mpl_error,
};

use crate::state;
use crate::utils;

pub fn wrap_nft<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>]) -> ProgramResult {
    let ctx: crate::instruction::accounts::Context<WrapNFTAccounts> = WrapNFTAccounts::context(accounts)?;

    // we may additionally pass accounts for transfer hook
    let mut transfer_hook_accounts: Vec<&AccountInfo<'_>> = vec![];
    for i in 0..ctx.remaining_accounts.len() {
        transfer_hook_accounts.push(&ctx.remaining_accounts[i])
    }

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    let mut collection_data = Box::<CollectionData>::try_from_slice(&ctx.accounts.collection_data.data.borrow()[..])?;

    let _collection_bump_seed = accounts::check_program_data_account(
        ctx.accounts.collection_data,
        program_id,
        vec![collection_data.page_name.as_bytes(), b"Collection"],
    )
    .unwrap();

    // if this is mint only then we can't wrap
    let plugin_map = get_collection_plugin_map(collection_data.plugins.clone());
    // check if we are mint only
    let mint_only_option = plugin_map.get(&CollectionPluginType::MintOnly);
    if mint_only_option.is_some() {
        msg!("collection is mint only");
        return Err(ProgramError::InvalidAccountData);
    }

    if ctx.accounts.token_mint.key != &collection_data.keys[CollectionKeys::MintAddress as usize] {
        msg!("token mint does not match");
        return Err(ProgramError::InvalidAccountData);
    }

    accounts::check_token_account(
        ctx.accounts.cook_pda,
        ctx.accounts.token_mint,
        ctx.accounts.cook_token,
        ctx.accounts.token_program,
    )?;

    accounts::check_core_key(ctx.accounts.core_program)?;
    accounts::check_system_program_key(ctx.accounts.system_program)?;
    let is_2022 = accounts::check_token_program_key(ctx.accounts.token_program)?;
    accounts::check_associated_token_program_key(ctx.accounts.associated_token)?;

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

    user_data.stats.values[state::Achievement32::NumWraps as usize] += 1;

    user_data.serialize(&mut &mut ctx.accounts.user_data.data.borrow_mut()[..])?;

    // check if we need to create the users token account
    utils::check_and_create_ata(
        ctx.accounts.user,
        ctx.accounts.user,
        ctx.accounts.token_mint,
        ctx.accounts.user_token,
        ctx.accounts.token_program,
        ctx.accounts.system_program,
        ctx.accounts.associated_token,
    )?;

    let mint_data = ctx.accounts.token_mint.data.borrow();
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&mint_data)?;
    let input_amount = if let Ok(transfer_fee_config) = mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>() {
        let fee = transfer_fee_config
            .calculate_epoch_fee(Clock::get()?.epoch, collection_data.swap_price)
            .ok_or(ProgramError::InvalidArgument)?;
        collection_data.swap_price.saturating_sub(fee)
    } else {
        collection_data.swap_price
    };

    let swap_fee: u64 = ((input_amount as f64) * ((collection_data.swap_fee as f64) / 100.0 / 100.0)) as u64;

    let output_amount = input_amount.saturating_sub(swap_fee);

    let final_output_amount = if let Ok(transfer_fee_config) = mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>() {
        let fee = transfer_fee_config
            .calculate_epoch_fee(Clock::get()?.epoch, output_amount)
            .ok_or(ProgramError::InvalidArgument)?;
        output_amount.saturating_sub(fee)
    } else {
        output_amount
    };
    msg!(
        "actual input amount was {} fee {} output {} final output {}",
        input_amount,
        swap_fee,
        output_amount,
        final_output_amount
    );

    utils::transfer_tokens(
        is_2022,
        output_amount,
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

    if swap_fee > 0 && collection_data.swap_fee < 10000 {
        utils::transfer_tokens(
            is_2022,
            swap_fee,
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
    }

    match collection_data.collection_meta {
        CollectionMeta::RandomFixedSupply(ref mut args) => {
            // we only care about lookups for fixed supply collections

            let (_, attributes, _) = unsafe {
                mpl_core::fetch_plugin::<mpl_core::accounts::BaseAssetV1, mpl_core::types::Attributes>(
                    unsafe { std::mem::transmute(ctx.accounts.asset) },
                    mpl_core::types::PluginType::Attributes,
                )
            }.map_err(|e| convert_mpl_error(e))?;

            let asset_index = attributes.attribute_list[0].value.parse::<u32>().unwrap();

            collection_data.num_available += 1;

            if collection_data.num_available > collection_data.total_supply {
                msg!("num available has increased beyond collection size");
                return Err(ProgramError::InvalidAccountData);
            }

            let len: usize = args.availability.len();
            let block = (asset_index / 8) as usize;
            let bit_index = asset_index - ((block * 8) as u32);
            let bit_value = (2u8).pow(bit_index) as u8;

            msg!("returning {} to block {} index {} value {}", asset_index, block, bit_index, bit_value);
            args.availability[block] = args.availability[block] ^ bit_value;
            args.availability[block + len / 2] += 1;

            if args.availability[block + len / 2] > 8 {
                msg!("num available has increased beyond block size");
                return Err(ProgramError::InvalidAccountData);
            }

            collection_data.serialize(&mut &mut ctx.accounts.collection_data.data.borrow_mut()[..])?;
        }
        CollectionMeta::RandomUnlimited(ref _args) => {
            // nothing additional to do here
        }
    }

    // burn the asset
    unsafe {
        mpl_core::instructions::BurnV1CpiBuilder::new(unsafe { std::mem::transmute(ctx.accounts.core_program) })
            .asset(unsafe { std::mem::transmute(ctx.accounts.asset) })
            .collection(Some(unsafe { std::mem::transmute(ctx.accounts.collection) }))
            .authority(Some(unsafe { std::mem::transmute(ctx.accounts.user) }))
            .payer(unsafe { std::mem::transmute(ctx.accounts.user) })
            .system_program(Some(unsafe { std::mem::transmute(ctx.accounts.system_program) }))
            .invoke_signed(&[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_sol_bump_seed]]])
            .map_err(|e| convert_mpl_error(e))?;
    }

    Ok(())
}
