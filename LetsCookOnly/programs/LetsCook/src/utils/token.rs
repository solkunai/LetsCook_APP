use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::invoke,
    program::invoke_signed,
    program_pack::Pack,
    system_instruction,
};
use spl_pod::optional_keys::OptionalNonZeroPubkey;
use spl_token_2022::{
    extension::{BaseStateWithExtensions, StateWithExtensions},
    state::Account,
};

use crate::utils;
use crate::{state, utils::calculate_rent};

pub fn get_token_balance<'a>(token_source_account: &AccountInfo<'a>) -> u64 {
    let base_data = &token_source_account.try_borrow_data().unwrap();
    let account_state = StateWithExtensions::<Account>::unpack(base_data).unwrap();

    return account_state.base.amount;
}

pub fn get_amount_post_transfer_fee<'a>(quantity: u64, token_mint: &AccountInfo<'a>) -> Result<u64> {
    let token_mint_data = token_mint.data.borrow();
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&token_mint_data)?;
    let quantity_after_transfer = if let Ok(transfer_fee_config) = mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>()
    {
        let fee = transfer_fee_config
            .calculate_epoch_fee(Clock::get()?.epoch, quantity)
            .ok_or(Error::InvalidArgument)?;
        quantity.saturating_sub(fee)
    } else {
        quantity
    };

    Ok(quantity_after_transfer)
}

pub fn get_amount_pre_transfer_fee<'a>(quantity: u64, token_mint: &AccountInfo<'a>) -> Result<u64> {
    let token_mint_data = token_mint.data.borrow();
    let mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&token_mint_data)?;
    let quantity_for_transfer = if let Ok(transfer_fee_config) = mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>() {
        let fee = transfer_fee_config
            .calculate_inverse_epoch_fee(Clock::get()?.epoch, quantity)
            .ok_or(Error::InvalidArgument)?;
        quantity.saturating_add(fee)
    } else {
        quantity
    };

    Ok(quantity_for_transfer)
}

pub fn create_token_account<'a>(
    user_account_info: &'a AccountInfo<'a>,
    token_account: &'a AccountInfo<'a>,
    token_mint: &AccountInfo<'a>,
    token_program: &'a AccountInfo<'a>,
    pda_account: &'a AccountInfo<'a>,
    bump_seed: u8,
    seed: Vec<&[u8]>,
) -> ProgramResult {
    if **token_account.try_borrow_lamports()? > 0 {
        msg!("Token account is already initialised.");
        return Ok(());
    }

    let token_lamports = calculate_rent(spl_token_2022::state::Account::LEN as u64);

    // create the token account
    let base_ix = system_instruction::create_account(
        user_account_info.key,
        token_account.key,
        token_lamports,
        spl_token_2022::state::Account::LEN as u64,
        token_program.key,
    );

    //let seed_refs: Vec<&[u8]> = seed.iter().map(|s| *s).collect();

    // Create the full seeds array including the bump
    //let mut full_seeds = seed_refs.clone();

    // Create the bump seed array first so it lives long enough
    //let bump_seed = [pda_bump];

    //full_seeds.push(&bump_seed);

    // Create the seeds slice for invoke_signed
    //let signer_seeds = &[full_seeds.as_slice()];

    invoke_signed(
        &base_ix,
        &[user_account_info.clone(), token_account.clone(), token_program.clone()],
        &[&[seed[0], seed[1], &[bump_seed]]],
    )?;

    let init_base_idx =
        spl_token_2022::instruction::initialize_account3(token_program.key, token_account.key, token_mint.key, pda_account.key).unwrap();

    invoke_signed(
        &init_base_idx,
        &[token_program.clone(), token_account.clone(), token_mint.clone(), pda_account.clone()],
        &[&[seed[0], seed[1], &[bump_seed]]],
    )?;

    Ok(())
}

pub fn create_2022_token<'a>(
    funding_account: &'a AccountInfo<'a>,
    pda_account: &'a AccountInfo<'a>,
    token_program: &'a AccountInfo<'a>,
    pda_bump: u8,

    // nft accounts
    mint_account: &'a AccountInfo<'a>,
    token_account: &'a AccountInfo<'a>,
    token_account_owner: &'a AccountInfo<'a>,
    token_config: state::TokenDetails,

    // token extensions
    transfer_fee: u16,
    max_transfer_fee: u64,
    permanent_delegate_option: Option<&'a AccountInfo<'a>>,
    transfer_hook_program_option: Option<&'a AccountInfo<'a>>,
) -> ProgramResult {
    let mut extension_types: Vec<spl_token_2022::extension::ExtensionType> = Vec::new();

    if transfer_fee > 0 {
        extension_types.push(spl_token_2022::extension::ExtensionType::TransferFeeConfig);
    }

    if permanent_delegate_option.is_some() {
        extension_types.push(spl_token_2022::extension::ExtensionType::PermanentDelegate);
    }
    if transfer_hook_program_option.is_some() {
        extension_types.push(spl_token_2022::extension::ExtensionType::TransferHook);
    }

    extension_types.push(spl_token_2022::extension::ExtensionType::MetadataPointer);

    let token_metadata = spl_token_metadata_interface::state::TokenMetadata {
        name: token_config.name,
        symbol: token_config.symbol,
        uri: token_config.uri,
        update_authority: OptionalNonZeroPubkey(*pda_account.key),
        mint: *mint_account.key,
        ..Default::default()
    };

    let instance_size = token_metadata.try_to_vec()?.len();

    // first create the mint account for the new NFT

    let space = spl_token_2022::extension::ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(&extension_types).unwrap();
    // first create the mint account for the new NFT
    let mint_rent = calculate_rent((space + instance_size + 8) as u64);

    let ix = system_instruction::create_account(funding_account.key, mint_account.key, mint_rent, space as u64, token_program.key);

    msg!("create account");
    // Sign and submit transaction
    invoke(&ix, &[funding_account.clone(), mint_account.clone()])?;

    if transfer_fee > 0 {
        msg!("init transfer config {} {}", transfer_fee, max_transfer_fee);
        let config_init_idx = spl_token_2022::extension::transfer_fee::instruction::initialize_transfer_fee_config(
            &spl_token_2022::ID,
            &mint_account.key,
            None,
            Some(&funding_account.key),
            transfer_fee,
            max_transfer_fee,
        )
        .unwrap();

        invoke(&config_init_idx, &[token_program.clone(), mint_account.clone(), funding_account.clone()])?;
    }

    if permanent_delegate_option.is_some() {
        let permanent_delegate = permanent_delegate_option.unwrap();
        msg!("init delegate config");
        let config_init_idx =
            spl_token_2022::instruction::initialize_permanent_delegate(&token_program.key, &mint_account.key, &permanent_delegate.key).unwrap();

        invoke(
            &config_init_idx,
            &[token_program.clone(), mint_account.clone(), permanent_delegate.clone()],
        )?;
    }

    if transfer_hook_program_option.is_some() {
        msg!("init transfer hook");
        let transfer_hook_program = transfer_hook_program_option.unwrap();
        let config_init_idx = spl_token_2022::extension::transfer_hook::instruction::initialize(
            &spl_token_2022::ID,
            &mint_account.key,
            None,
            Some(*transfer_hook_program.key),
        )
        .unwrap();

        invoke(
            &config_init_idx,
            &[
                token_program.clone(),
                mint_account.clone(),
                funding_account.clone(),
                transfer_hook_program.clone(),
            ],
        )?;
    }

    let metadata_config_init_idx =
        spl_token_2022::extension::metadata_pointer::instruction::initialize(&spl_token_2022::ID, &mint_account.key, None, Some(*mint_account.key))
            .unwrap();

    invoke(
        &metadata_config_init_idx,
        &[token_program.clone(), mint_account.clone(), funding_account.clone()],
    )?;

    // initialize the mint, mint and freeze authority will be with the pda
    let mint_idx =
        spl_token_2022::instruction::initialize_mint2(token_program.key, mint_account.key, pda_account.key, None, token_config.decimals).unwrap();

    msg!("init mint");
    // Sign and submit transaction
    invoke(&mint_idx, &[token_program.clone(), mint_account.clone(), funding_account.clone()])?;

    // now actually set the metadata
    invoke_signed(
        &spl_token_metadata_interface::instruction::initialize(
            &spl_token_2022::id(),
            mint_account.key,
            pda_account.key,
            mint_account.key,
            pda_account.key,
            token_metadata.name.to_string(),
            token_metadata.symbol.to_string(),
            token_metadata.uri.to_string(),
        ),
        &[mint_account.clone(), pda_account.clone()],
        &[&[&token_config.pda.to_le_bytes()[..], &[pda_bump][..]]],
    )?;
    // then revoke update authority
    invoke_signed(
        &spl_token_metadata_interface::instruction::update_authority(
            &spl_token_2022::id(),
            mint_account.key,
            pda_account.key,
            OptionalNonZeroPubkey(Pubkey::from([0 as u8; 32])),
        ),
        &[mint_account.clone(), pda_account.clone()],
        &[&[&token_config.pda.to_le_bytes()[..], &[pda_bump][..]]],
    )?;

    // create the ATA, this will belong to the pda account
    utils::check_and_create_ata(funding_account, token_account_owner, mint_account, token_account, token_program)?;

    // mint the token to the pda
    let mint_to_idx = spl_token_2022::instruction::mint_to_checked(
        token_program.key,
        mint_account.key,
        token_account.key,
        pda_account.key,
        &[pda_account.key],
        token_config.total_supply,
        token_config.decimals,
    )
    .unwrap();

    invoke_signed(
        &mint_to_idx,
        &[
            token_program.clone(),
            mint_account.clone(),
            token_account.clone(),
            funding_account.clone(),
            pda_account.clone(),
        ],
        &[&[&token_config.pda.to_le_bytes()[..], &[pda_bump][..]]],
    )?;

    let revoke_authority = spl_token_2022::instruction::set_authority(
        token_program.key,
        mint_account.key,
        None,
        spl_token_2022::instruction::AuthorityType::MintTokens,
        pda_account.key,
        &[pda_account.key],
    )?;

    invoke_signed(
        &revoke_authority,
        &[token_program.clone(), mint_account.clone(), pda_account.clone()],
        &[&[&token_config.pda.to_le_bytes()[..], &[pda_bump][..]]],
    )?;

    Ok(())
}
