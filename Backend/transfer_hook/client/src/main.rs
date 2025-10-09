pub mod state;

use crate::state::{Result, TransferHookInstruction};
use std::env;
use std::str::FromStr;

use borsh::{BorshDeserialize, BorshSerialize};
use solana_client::rpc_client::RpcClient;
use solana_program::pubkey::Pubkey;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    signer::keypair::read_keypair_file,
    signer::Signer,
    transaction::Transaction,
};
use solana_transaction_status::UiTransactionEncoding;
use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token_2022;

const URL: &str = "https://api.devnet.solana.com";
const HOOK_PUBKEY: &str = "FEES7x83BdGUFsrJG6VmZywkquvBNiFgyBaAdAMcJfst";

fn main() {
    let args: Vec<String> = env::args().collect();
    let key_file = &args[1];
    let function = &args[2];

    if function == "create" {
        if let Err(err) = create(key_file) {
            eprintln!("{:?}", err);
            std::process::exit(1);
        }
    }
    if function == "transfer" {
        if let Err(err) = transfer(key_file) {
            eprintln!("{:?}", err);
            std::process::exit(1);
        }
    }
}
#[derive(BorshSerialize, BorshDeserialize)]
pub struct Payload {
    variant: u8,
    extension: u16,
}
pub fn create(key_file: &String) -> Result<()> {
    // (2) Create a new Keypair for the new account
    let wallet = read_keypair_file(key_file).unwrap();

    // (3) Create RPC client to be used to talk to Solana cluster
    let connection = RpcClient::new(URL);

    let lets_cook = Pubkey::from_str("9oQVwjBf5HQuRJFEv8yrLqoGYsR2jUDRUSHmDawpAdap").unwrap();
    let hook_program = Pubkey::from_str(HOOK_PUBKEY).unwrap();
    let wrapped_sol = Pubkey::from_str("So11111111111111111111111111111111111111112").unwrap();

    let mint_address = Pubkey::from_str("THJ526FWnpjq5pMLUYSLfPxyvtvwxHP8pkDPKykZrJz").unwrap();
    let (expected_validation_address, bump_seed) =
        state::get_extra_account_metas_address_and_bump_seed(&mint_address, &hook_program);

    let (expected_launch_account, bump_seed) =
        Pubkey::find_program_address(&[b"NewTHTest", b"Launch"], &lets_cook);

    let base_first = mint_address.to_string() < wrapped_sol.to_string();
    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();

    if base_first {
        amm_seed_keys.push(mint_address);
        amm_seed_keys.push(wrapped_sol)
    } else {
        amm_seed_keys.push(wrapped_sol);
        amm_seed_keys.push(mint_address);
    }

    let (amm_account, _amm_bump_seed) = Pubkey::find_program_address(
        &[
            &amm_seed_keys[0].to_bytes(),
            &amm_seed_keys[1].to_bytes(),
            b"AMM",
        ],
        &lets_cook,
    );
    let instruction_data = TransferHookInstruction::InitializeExtraAccountMetas.pack();

    println!("instruction data {:?}", instruction_data);

    let instruction = Instruction::new_with_bytes(
        hook_program,
        &instruction_data,
        vec![
            AccountMeta::new(expected_validation_address, false),
            AccountMeta::new(mint_address, false),
            AccountMeta::new_readonly(wallet.pubkey(), true),
            AccountMeta::new(solana_sdk::system_program::id(), false),
            AccountMeta::new_readonly(expected_launch_account, false),
            AccountMeta::new_readonly(amm_account, false),
        ],
    );

    let signers = [&wallet];
    let instructions = vec![instruction];
    let recent_hash = connection.get_latest_blockhash()?;

    let txn = Transaction::new_signed_with_payer(
        &instructions,
        Some(&wallet.pubkey()),
        &signers,
        recent_hash,
    );

    let signature = connection.send_and_confirm_transaction(&txn)?;
    println!("signature: {}", signature);
    let response = connection.get_transaction(&signature, UiTransactionEncoding::Json)?;
    println!("result: {:#?}", response);

    Ok(())
}

pub fn transfer(key_file: &String) -> Result<()> {
    // (2) Create a new Keypair for the new account
    let wallet = read_keypair_file(key_file).unwrap();

    // (3) Create RPC client to be used to talk to Solana cluster
    let connection = RpcClient::new(URL);

    let hook_program = Pubkey::from_str(HOOK_PUBKEY).unwrap();
    let lets_cook = Pubkey::from_str("9oQVwjBf5HQuRJFEv8yrLqoGYsR2jUDRUSHmDawpAdap").unwrap();

    let mint_address = Pubkey::from_str("E4aURieH58RCnEVRtYnbay7Leorh7nSYgHdsnprERqPE").unwrap();
    let quote_mint = Pubkey::from_str("So11111111111111111111111111111111111111112").unwrap();
    let (expected_validation_address, bump_seed) =
        state::get_extra_account_metas_address_and_bump_seed(&mint_address, &hook_program);

    let (expected_data_account, bump_seed) =
        Pubkey::find_program_address(&[b"Test", b"Launch"], &lets_cook);

    let base_first = mint_address.to_string() < quote_mint.to_string();

    let mut amm_seed_keys: Vec<Pubkey> = Vec::new();

    if base_first {
        amm_seed_keys.push(mint_address);
        amm_seed_keys.push(quote_mint)
    } else {
        amm_seed_keys.push(quote_mint);
        amm_seed_keys.push(mint_address);
    }

    let (expected_amm_account, bump_seed) = Pubkey::find_program_address(
        &[
            &amm_seed_keys[0].to_bytes(),
            &amm_seed_keys[1].to_bytes(),
            b"AMM",
        ],
        &lets_cook,
    );

    println!("amm: {:?}", expected_amm_account);

    let expected_token_account = get_associated_token_address_with_program_id(
        &wallet.pubkey(),
        &mint_address,
        &spl_token_2022::id(),
    );

    let expected_amm_token_account = get_associated_token_address_with_program_id(
        &expected_amm_account,
        &mint_address,
        &spl_token_2022::id(),
    );

    const SOL_SEED: u32 = 59957379;

    let (expected_lc_pda, bump_seed) =
        Pubkey::find_program_address(&[&SOL_SEED.to_le_bytes()], &lets_cook);

    let expected_LC_token_account = get_associated_token_address_with_program_id(
        &expected_lc_pda,
        &mint_address,
        &spl_token_2022::id(),
    );

    println!("token: {:?}", expected_amm_token_account);

    let mut ix = spl_token_2022::instruction::transfer_checked(
        &spl_token_2022::id(),
        &expected_LC_token_account,
        &mint_address,
        &expected_token_account,
        &wallet.pubkey(),
        &[],
        1,
        1,
    )
    .unwrap();

    println!("add accounts");

    ix.accounts
        .push(AccountMeta::new_readonly(hook_program, false));

    ix.accounts.push(AccountMeta::new_readonly(
        expected_validation_address,
        false,
    ));
    ix.accounts
        .push(AccountMeta::new(expected_data_account, false));

    ix.accounts
        .push(AccountMeta::new(expected_amm_account, false));

    println!("token: {:?}", expected_LC_token_account);
    println!("token: {:?}", expected_amm_token_account);
    println!("token: {:?}", mint_address);
    println!("token: {:?}", expected_token_account);
    println!("token: {:?}", expected_validation_address);
    println!("token: {:?}", expected_data_account);
    println!("token: {:?}", expected_amm_account);

    let signers = [&wallet];
    let instructions = vec![ix];

    println!("get blockhash");
    let recent_hash = connection.get_latest_blockhash()?;

    let txn = Transaction::new_signed_with_payer(
        &instructions,
        Some(&wallet.pubkey()),
        &signers,
        recent_hash,
    );
    println!("submit transaction");
    let signature = connection.send_and_confirm_transaction(&txn)?;
    println!("signature: {}", signature);
    let response = connection.get_transaction(&signature, UiTransactionEncoding::Json)?;
    println!("result: {:#?}", response);

    Ok(())
}
