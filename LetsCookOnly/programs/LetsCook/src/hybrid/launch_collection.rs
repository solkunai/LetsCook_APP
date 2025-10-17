use borsh::{to_vec, BorshSerialize};

use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError, pubkey::Pubkey};

use crate::hybrid::{
    CollectionData, CollectionKeys, CollectionMeta, CollectionMetaType, CollectionPlugin, MintProbability, RandomFixedSupply, RandomUnlimited,
    WhiteListToken,
};
use crate::instruction::LaunchCollectionArgs;
use crate::{accounts, instruction::accounts::LaunchCollectionAccounts, launch};

use crate::state;
use crate::utils::{self, mint_collection};

pub fn launch_collection<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], args: LaunchCollectionArgs) -> ProgramResult {
    msg!("in launch collection, getting accounts");

    let ctx: crate::instruction::accounts::Context<LaunchCollectionAccounts> = LaunchCollectionAccounts::context(accounts)?;
    msg!("verify accounts");

    if !ctx.accounts.user.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let launch_bump_seed =
        accounts::check_program_data_account(ctx.accounts.collection_data, program_id, vec![args.page_name.as_bytes(), b"Collection"]).unwrap();

    let pda_sol_bump_seed = accounts::check_program_data_account(ctx.accounts.cook_pda, program_id, vec![&accounts::SOL_SEED.to_le_bytes()]).unwrap();

    accounts::check_system_program_key(ctx.accounts.system_program)?;
    accounts::check_core_key(ctx.accounts.core_program)?;

    // Handle any other checks

    // if this page name has been used, cancel
    if **ctx.accounts.collection_data.try_borrow_lamports()? > 0 {
        msg!("This page name already exists");
        return Ok(());
    }

    msg!("create game account");

    let collection_meta: CollectionMeta = match args.collection_type {
        CollectionMetaType::RandomFixedSupply => {
            let mut availability_len: usize = (args.collection_size / 4 + 2) as usize;
            if availability_len % 2 != 0 {
                availability_len += 1;
            }
            let mut state = RandomFixedSupply {
                availability: Vec::with_capacity(availability_len),
            };

            state.availability = vec![0; availability_len];
            for j in (availability_len / 2)..availability_len {
                state.availability[j] = 8;
            }

            CollectionMeta::RandomFixedSupply(state)
        }
        CollectionMetaType::RandomUnlimited => CollectionMeta::RandomUnlimited(RandomUnlimited {}),
    };

    let mut launch_data = CollectionData {
        account_type: state::AccountType::CollectionLaunch,
        launch_id: 0,

        collection_meta: collection_meta,
        plugins: Vec::new(),
        collection_name: args.collection_name,
        collection_symbol: args.collection_symbol,
        collection_icon_url: args.collection_icon,
        collection_meta_url: args.collection_uri,

        token_name: args.token_name,
        token_symbol: args.token_symbol,
        token_icon_url: args.token_icon,
        token_decimals: args.token_decimals,
        token_extensions: args.token_extensions,

        nft_icon_url: args.nft_icon,
        nft_meta_url: args.nft_uri,
        nft_name: args.nft_name,
        nft_type: args.nft_type,

        banner_url: args.banner,
        description: "".to_string(),
        page_name: args.page_name,
        total_supply: args.collection_size,
        swap_fee: args.swap_fee,
        num_available: args.collection_size,
        swap_price: args.swap_price,
        positive_votes: 0,
        negative_votes: 0,
        total_mm_buy_amount: 0,
        total_mm_sell_amount: 0,
        last_mm_reward_date: 0,
        socials: Vec::with_capacity(state::Socials::LENGTH as usize),
        flags: Vec::with_capacity(launch::LaunchFlags::LENGTH as usize),
        strings: Vec::new(),
        keys: Vec::with_capacity(launch::LaunchKeys::LENGTH as usize),
    };

    if args.nft_probability > 0 {
        let plugin = CollectionPlugin::MintProbability(MintProbability {
            mint_prob: args.nft_probability,
        });

        launch_data.plugins.push(plugin);
    }

    if ctx.accounts.whitelist_mint.is_some() {
        let plugin = CollectionPlugin::WhiteListToken(WhiteListToken {
            key: *ctx.accounts.whitelist_mint.unwrap().key,
            quantity: args.whitelist_tokens,
            phase_end: args.whitelist_end,
        });

        launch_data.plugins.push(plugin);
    }

    if args.mint_only == 1 {
        let plugin = CollectionPlugin::MintOnly();

        launch_data.plugins.push(plugin);
    }

    launch_data.socials = vec!["".to_string(); state::Socials::LENGTH as usize];

    launch_data.keys = vec![Pubkey::default(); CollectionKeys::LENGTH as usize];
    launch_data.keys[CollectionKeys::MintAddress as usize] = *ctx.accounts.token_mint.key;
    launch_data.keys[CollectionKeys::Seller as usize] = *ctx.accounts.user.key;
    launch_data.keys[CollectionKeys::CollectionAddress as usize] = *ctx.accounts.collection.key;
    launch_data.keys[CollectionKeys::TeamWallet as usize] = *ctx.accounts.team.key;

    launch_data.flags = vec![0; launch::LaunchFlags::LENGTH as usize];

    launch_data.flags[launch::LaunchFlags::Extensions as usize] = args.nft_extensions;

    let game_len = to_vec(&launch_data).unwrap().len();

    // create the account if required
    utils::create_program_account(
        ctx.accounts.user,
        ctx.accounts.collection_data,
        program_id,
        launch_bump_seed,
        game_len,
        vec![launch_data.page_name.as_bytes(), b"Collection"],
    )?;

    launch_data.serialize(&mut &mut ctx.accounts.collection_data.data.borrow_mut()[..])?;

    let collection_config = state::CollectionDetails {
        name: launch_data.collection_name.to_string(),
        index: 0,
        uri: launch_data.collection_meta_url.to_string(),
        pda: accounts::SOL_SEED,
    };

    // mint the token
    mint_collection(
        ctx.accounts.user,
        ctx.accounts.cook_pda,
        pda_sol_bump_seed,
        ctx.accounts.system_program,
        ctx.accounts.core_program,
        ctx.accounts.team,
        ctx.accounts.collection,
        collection_config,
        args.attributes,
    )
    .unwrap();

    Ok(())
}
