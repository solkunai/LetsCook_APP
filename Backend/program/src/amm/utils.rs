use borsh::{to_vec, BorshDeserialize, BorshSerialize};

use solana_program::clock::Clock;
use solana_program::native_token::LAMPORTS_PER_SOL;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program::invoke, program::invoke_signed, program_error::ProgramError,
    program_pack::Pack, pubkey::Pubkey, system_instruction, sysvar::Sysvar,
};
use spl_token_2022::extension::{BaseStateWithExtensions, StateWithExtensions};

use crate::amm::{get_amm_data_size, get_amm_seeds, get_candle_size, AMMPlugin, LiquidityScaling, TimeSeriesData, TradeToEarn, AMM, OHLCV};
use crate::utils::{self, calculate_rent};
use crate::{accounts, state};

pub fn create_lp_mint<'a>(
    user_account_info: &'a AccountInfo<'a>,
    amm_account_info: &'a AccountInfo<'a>,
    lp_token_mint_account_info: &'a AccountInfo<'a>,
    token_program_account_info: &'a AccountInfo<'a>,
    pda: &'a AccountInfo<'a>,
    quote_mint: &StateWithExtensions<spl_token_2022::state::Mint>,
    lp_bump_seed: u8,
    pda_bump_seed: u8,
) -> ProgramResult {
    if **lp_token_mint_account_info.try_borrow_lamports()? > 0 {
        msg!("LP Mint account is already initialised.");
        return Ok(());
    }

    let space = spl_token::state::Mint::LEN;
    // first create the mint account for the new NFT
    let mint_rent = calculate_rent(space as u64);

    let ix = solana_program::system_instruction::create_account(
        user_account_info.key,
        lp_token_mint_account_info.key,
        mint_rent,
        space as u64,
        token_program_account_info.key,
    );

    msg!("create account");
    // Sign and submit transaction
    invoke_signed(
        &ix,
        &[user_account_info.clone(), lp_token_mint_account_info.clone()],
        &[
            &[&amm_account_info.key.to_bytes(), b"LP", &[lp_bump_seed]],
            &[&accounts::SOL_SEED.to_le_bytes(), &[pda_bump_seed]],
        ],
    )?;

    // initialize the mint, mint and freeze authority will be with the pda
    let mint_idx = spl_token_2022::instruction::initialize_mint2(
        token_program_account_info.key,
        lp_token_mint_account_info.key,
        pda.key,
        None,
        quote_mint.base.decimals,
    )
    .unwrap();

    msg!("init mint");
    // Sign and submit transaction
    invoke_signed(
        &mint_idx,
        &[
            token_program_account_info.clone(),
            lp_token_mint_account_info.clone(),
            user_account_info.clone(),
        ],
        &[&[&accounts::SOL_SEED.to_le_bytes(), &[pda_bump_seed]]],
    )?;

    return Ok(());
}

pub fn create_amm<'a>(
    user_account_info: &'a AccountInfo<'a>,
    pool_account_info: &'a AccountInfo<'a>,
    amm_account_info: &'a AccountInfo<'a>,
    amm_wrapped_sol_account_info: &'a AccountInfo<'a>,
    wrapped_sol_mint_account_info: &'a AccountInfo<'a>,
    base_token_account_info: &'a AccountInfo<'a>,
    base_token_mint_account_info: &'a AccountInfo<'a>,
    lp_token_mint_account_info: &'a AccountInfo<'a>,
    token_program_account_info: &'a AccountInfo<'a>,
    base_token_program: &'a AccountInfo<'a>,
    program_id: &Pubkey,
    amm_bump_seed: u8,
    amm_fee: u16,
    amm_provider: u8,
    trade_to_earn_fraction: u8,
    trade_to_earn_account: &'a AccountInfo<'a>,
    trade_to_earn_bump: u8,
    liquidity_scale: bool,
) -> ProgramResult {
    let amm_account_lamports = **amm_account_info.try_borrow_lamports()?;

    if amm_account_lamports > 0 {
        msg!("amm already initialized");
        return Ok(());
    }

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();
    get_amm_seeds(*base_token_mint_account_info.key, *wrapped_sol_mint_account_info.key, &mut amm_seed_keys);
    let amm_provider_bytes: &[u8] = if amm_provider == 0 {
        b"CookAMM"
    } else if amm_provider == 1 {
        b"RaydiumCPMM"
    } else {
        b"Raydium"
    };

    // first create the AMM account.  the seeds are ordered so that we only get one amm per base/quote pair
    msg!("creating amm data account");
    utils::create_program_account(
        user_account_info,
        amm_account_info,
        program_id,
        amm_bump_seed,
        get_amm_data_size(),
        vec![&amm_seed_keys[0].to_bytes(), &amm_seed_keys[1].to_bytes(), amm_provider_bytes],
    )?;

    let mut amm_data = AMM::try_from_slice(&amm_account_info.data.borrow()[..])?;

    amm_data.account_type = state::AccountType::AMM;
    amm_data.pool = *pool_account_info.key;
    amm_data.amm_provider = amm_provider;
    amm_data.base_mint = *base_token_mint_account_info.key;
    amm_data.quote_mint = *wrapped_sol_mint_account_info.key;
    amm_data.lp_mint = *lp_token_mint_account_info.key;
    amm_data.base_key = *base_token_account_info.key;
    amm_data.quote_key = *amm_wrapped_sol_account_info.key;
    amm_data.fee = amm_fee;

    let mut plugin_vec: Vec<AMMPlugin> = Vec::new();
    // check if we are including scaling
    if liquidity_scale {
        let liquidity_scale = AMMPlugin::LiquidityScaling(LiquidityScaling {
            scalar: 15,
            threshold: 10 * LAMPORTS_PER_SOL,
            active: 1,
        });
        plugin_vec.push(liquidity_scale);
    }

    // check if we need to make the trade to earn plugin and accounts
    msg!("trade to earn fraction {}", trade_to_earn_fraction);
    if trade_to_earn_fraction > 0 {
        msg!("creating trade to earn plugin");
        let token_lamports = calculate_rent(spl_token::state::Account::LEN as u64);

        // create the temporary wsol account
        let base_ix = solana_program::system_instruction::create_account(
            user_account_info.key,
            trade_to_earn_account.key,
            token_lamports,
            spl_token::state::Account::LEN as u64,
            base_token_program.key,
        );

        invoke_signed(
            &base_ix,
            &[user_account_info.clone(), trade_to_earn_account.clone(), base_token_program.clone()],
            &[&[&amm_account_info.key.to_bytes(), b"TradeToEarn", &[trade_to_earn_bump]]],
        )?;

        let init_base_idx = spl_token_2022::instruction::initialize_account3(
            base_token_program.key,
            trade_to_earn_account.key,
            base_token_mint_account_info.key,
            amm_account_info.key,
        )
        .unwrap();

        invoke_signed(
            &init_base_idx,
            &[
                base_token_program.clone(),
                trade_to_earn_account.clone(),
                base_token_mint_account_info.clone(),
                amm_account_info.clone(),
            ],
            &[&[&amm_account_info.key.to_bytes(), b"TradeToEarn", &[trade_to_earn_bump]]],
        )?;

        let trade_to_earn = AMMPlugin::TradeToEarn(TradeToEarn {
            total_tokens: 0,
            first_reward_date: 0,
            last_reward_date: 0,
        });

        plugin_vec.push(trade_to_earn);
    }

    if plugin_vec.len() > 0 {
        amm_data.plugins = plugin_vec;

        // realloc the amm account
        let new_len = to_vec(&amm_data).unwrap().len();
        let new_lamports = calculate_rent(new_len as u64);

        invoke(
            &system_instruction::transfer(user_account_info.key, amm_account_info.key, new_lamports - amm_account_lamports),
            &[user_account_info.clone(), amm_account_info.clone()],
        )?;

        amm_account_info.realloc(new_len, true)?;
    }

    amm_data.serialize(&mut &mut amm_account_info.data.borrow_mut()[..])?;

    if amm_provider > 0 {
        return Ok(()); // no need to create the associated token account
    }

    // create the ATA for the quote token
    utils::check_and_create_ata(
        user_account_info,
        amm_account_info,
        wrapped_sol_mint_account_info,
        amm_wrapped_sol_account_info,
        token_program_account_info,
    )?;

    // create the ATA for the base token
    utils::check_and_create_ata(
        user_account_info,
        amm_account_info,
        base_token_mint_account_info,
        base_token_account_info,
        base_token_program,
    )?;

    Ok(())
}

pub fn init_cook_amm_data<'a>(
    user_account_info: &'a AccountInfo<'a>,
    amm_account_info: &'a AccountInfo<'a>,
    amm_quote_account_info: &'a AccountInfo<'a>,
    amm_base_account_info: &'a AccountInfo<'a>,
    price_account_info: &'a AccountInfo<'a>,
    base_token_mint: &'a AccountInfo<'a>,
    quote_token_mint: &'a AccountInfo<'a>,
    program_id: &Pubkey,
    price_data_bump_seed: u8,
    num_price_accounts: u32,
) -> Result<u64, ProgramError> {
    let base_mint_data = base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;
    let quote_mint_data = quote_token_mint.data.borrow();
    let quote_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&quote_mint_data)?;

    let clock = Clock::get()?;
    // Now that we have transferred the tokens, set the initial amounts
    let initial_quote_amount = utils::get_token_balance(amm_quote_account_info);
    let initial_base_amount = utils::get_token_balance(amm_base_account_info);

    let base_float_amount = (initial_base_amount as f64) / 10_f64.powi(base_mint.base.decimals as i32);
    let quote_float_amount = (initial_quote_amount as f64) / 10_f64.powi(quote_mint.base.decimals as i32);

    let price = (quote_float_amount / base_float_amount) as f32;

    let mut amm_data = AMM::try_from_slice(&amm_account_info.data.borrow()[..])?;

    let lp_generated = f64::sqrt((initial_base_amount * initial_quote_amount) as f64) as u64;
    amm_data.last_price = price;
    amm_data.lp_amount = lp_generated;
    amm_data.amm_base_amount = initial_base_amount;
    amm_data.amm_quote_amount = initial_quote_amount;
    amm_data.start_time = clock.unix_timestamp as u64;

    amm_data.serialize(&mut &mut amm_account_info.data.borrow_mut()[..])?;

    msg!("initial balances {} {} {}", base_float_amount, quote_float_amount, price);

    let minute = clock.unix_timestamp / 60;

    let candle: OHLCV = OHLCV {
        timestamp: minute,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0.0,
    };

    let time_series = TimeSeriesData {
        account_type: state::AccountType::TimeSeries,
        data: vec![candle],
    };

    let price_data_size = to_vec(&time_series).unwrap().len();

    utils::create_program_account(
        user_account_info,
        price_account_info,
        program_id,
        price_data_bump_seed,
        price_data_size,
        vec![&amm_account_info.key.to_bytes(), &num_price_accounts.to_le_bytes(), b"TimeSeries"],
    )?;

    time_series.serialize(&mut &mut price_account_info.data.borrow_mut()[..])?;

    Ok(lp_generated)
}

pub fn reward_schedule(date: u32) -> f64 {
    if date < 10 {
        return 0.05;
    }
    if date >= 10 && date < 20 {
        return 0.03;
    }
    if date >= 20 && date < 30 {
        return 0.02;
    }

    return 0.0;
}

pub fn get_price(amm_base_amount: u64, amm_quote_amount: u64, base_decimals: u8, quote_decimals: u8) -> Result<f64, ProgramError> {
    let new_base_float_amount = amm_base_amount as f64 / 10_f64.powi(base_decimals as i32);
    let new_quote_float_amount = amm_quote_amount as f64 / 10_f64.powi(quote_decimals as i32);

    let new_price = new_quote_float_amount / new_base_float_amount;

    return Ok(new_price);
}

pub fn update_price_account<'a>(
    funding_account: &AccountInfo<'a>,
    price_data_account: &AccountInfo<'a>,
    price: f32,
    base_float_amount: f32,
) -> ProgramResult {
    let clock = Clock::get()?;

    let minute = clock.unix_timestamp / 60;
    let data_len = price_data_account.data_len();

    let candle_size = get_candle_size();
    let mut n_candles = u32::try_from_slice(&price_data_account.data.borrow()[1..5])?;
    let mut last_candle = OHLCV::try_from_slice(&price_data_account.data.borrow()[data_len - candle_size..data_len])?;

    if minute == last_candle.timestamp {
        last_candle.low = f32::min(price, last_candle.low);
        last_candle.high = f32::max(price, last_candle.high);

        last_candle.close = price;
        last_candle.volume += base_float_amount;

        last_candle.serialize(&mut &mut price_data_account.data.borrow_mut()[data_len - candle_size..data_len])?;
    } else {
        n_candles += 1;
        let new_candle: OHLCV = OHLCV {
            timestamp: minute,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: base_float_amount,
        };

        msg!("adding candle {} {}", n_candles, new_candle.close);
        let new_len = data_len + candle_size;

        let old_lamports = calculate_rent(data_len as u64);
        let new_lamports = calculate_rent(new_len as u64);

        if new_lamports > old_lamports {
            msg!(
                "update price data account to new size: {} current_balance: {} new_balance {}",
                new_len,
                old_lamports,
                new_lamports
            );

            invoke(
                &system_instruction::transfer(funding_account.key, price_data_account.key, new_lamports - old_lamports),
                &[funding_account.clone(), price_data_account.clone()],
            )?;
        }

        price_data_account.realloc(new_len, true)?;

        n_candles.serialize(&mut &mut price_data_account.data.borrow_mut()[1..5])?;
        new_candle.serialize(&mut &mut price_data_account.data.borrow_mut()[new_len - candle_size..new_len])?;
    }

    Ok(())
}

/// Calculate the scaling factor based on current AMM state and liquidity plugin parameters
fn get_scaling_factor(quote_amount: u64, liquidity_plugin: &LiquidityScaling) -> f64 {
    if quote_amount >= liquidity_plugin.threshold {
        return 1.0;
    }

    let scaling = (quote_amount as f64 * liquidity_plugin.scalar as f64 / 10.0) / (liquidity_plugin.threshold as f64);
    if scaling > 1.0 {
        1.0
    } else if scaling < 0.0002 {
        0.0002
    } else {
        scaling
    }
}

/// Calculate output amount for a trade using chunked calculation
/// side: 0 for buy (input quote, output base), 1 for sell (input base, output quote)
pub fn calculate_chunked_output(
    input_amount: u64,
    side: u8,
    amm_quote_amount: u64,
    amm_base_amount: u64,
    fee: u16,
    liquidity_plugin: &LiquidityScaling,
) -> u64 {
    if input_amount == 0 {
        return 0;
    }

    let max_chunks: u64 = 50;
    let min_chunk_size: u64 = if side == 0 { 100 } else { 100000 };
    let chunks = std::cmp::min(input_amount / min_chunk_size + 1, max_chunks);
    msg!("using {} {} {} chunks", input_amount, input_amount / min_chunk_size + 1, chunks);
    if chunks == 0 {
        return 0;
    }

    let chunk_size = (input_amount as f64) / (chunks as f64);
    let mut current_quote = amm_quote_amount;
    let mut current_base = amm_base_amount;
    let mut total_output: u64 = 0;

    for _ in 0..chunks {
        let scaling = get_scaling_factor(current_quote, liquidity_plugin);
        let input_fees = chunk_size * (fee as f64) / 100.0 / 100.0;
        let input_ex_fees = chunk_size - input_fees;
        if side == 0 {
            // Buy: input quote, output base
            let effective_input = input_ex_fees * scaling;
            let output = (effective_input * (current_base as f64) / ((current_quote as f64) + effective_input)) as u64;

            total_output += output;
            current_quote = current_quote.saturating_add(chunk_size as u64);
            current_base = current_base.saturating_sub(output);
        } else {
            // Sell: input base, output quote
            let effective_input = input_ex_fees / scaling;
            let output = (effective_input * (current_quote as f64) / (effective_input + (current_base as f64))) as u64;
            total_output += output;
            current_quote = current_quote.saturating_sub(output);
            current_base = current_base.saturating_add(chunk_size as u64);
        }
    }

    total_output
}

pub fn get_swap_amount<'a>(input_amount: u64, amm_base_amount: u64, amm_quote_amount: u64, fee: u16, side: u8) -> u64 {
    let input_fees = (input_amount as f64) * (fee as f64) / 100.0 / 100.0;
    let input_ex_fees = input_amount as f64 - input_fees;

    let output = if side == 0 {
        (input_ex_fees * (amm_base_amount as f64) / ((amm_quote_amount as f64) + input_ex_fees)) as u64
    } else {
        (input_ex_fees * (amm_quote_amount as f64) / (input_ex_fees + (amm_base_amount as f64))) as u64
    };

    output
}

pub fn check_swap<'a>(
    amm_base_amount: u64,
    amm_quote_amount: u64,
    base_token_mint: &AccountInfo<'a>,
    quote_token_mint: &AccountInfo<'a>,
    in_amount: u64,
    fee: u16,
    side: u8,
    is_transfer: bool,
    liquidity_plugin: Option<&LiquidityScaling>,
) -> Result<(u64, u64, f64, u8, u8), ProgramError> {
    // see if we need to consider transfer fees
    let base_mint_data = base_token_mint.data.borrow();
    let base_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&base_mint_data)?;
    let quote_mint_data = quote_token_mint.data.borrow();
    let quote_mint = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&quote_mint_data)?;

    let input_amount_after_transfer = if let Ok(transfer_fee_config) = if side == 1 {
        base_mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>()
    } else {
        quote_mint.get_extension::<spl_token_2022::extension::transfer_fee::TransferFeeConfig>()
    } {
        let fee = transfer_fee_config
            .calculate_epoch_fee(Clock::get()?.epoch, in_amount)
            .ok_or(ProgramError::InvalidArgument)?;
        in_amount.saturating_sub(fee)
    } else {
        in_amount
    };

    let input_amount = if is_transfer { input_amount_after_transfer } else { in_amount };

    let output = match liquidity_plugin {
        Some(plugin) => {
            if plugin.active == 1 {
                // Use chunked calculation if plugin is provided and active
                calculate_chunked_output(input_amount, side, amm_quote_amount, amm_base_amount, fee, plugin)
            } else {
                get_swap_amount(input_amount, amm_base_amount, amm_quote_amount, fee, side)
            }
        }
        None => {
            // Original constant product calculation
            get_swap_amount(input_amount, amm_base_amount, amm_quote_amount, fee, side)
        }
    };

    let base_amount = if side == 0 { output } else { in_amount };

    let quote_amount = if side == 0 { in_amount } else { output };

    msg!("base {} quote {}", base_amount, quote_amount);

    if output == 0 {
        msg!("Quantisation has reduced output to zero");
        return Err(ProgramError::InvalidAccountData);
    }

    // check what is left over is enough
    if side == 0 && amm_base_amount.saturating_sub(output) < 100 {
        msg!("Base quantity reduced below threshold");
        return Err(ProgramError::InvalidAccountData);
    }

    if side == 1 && amm_quote_amount.saturating_sub(output) < 100 {
        msg!("Quote quantity reduced below threshold");
        return Err(ProgramError::InvalidAccountData);
    }

    let base_float_amount = base_amount as f64 / 10_f64.powi(base_mint.base.decimals as i32);

    Ok((
        base_amount,
        quote_amount,
        base_float_amount,
        base_mint.base.decimals,
        quote_mint.base.decimals,
    ))
}
