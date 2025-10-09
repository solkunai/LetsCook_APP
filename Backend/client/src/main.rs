pub mod state;

use crate::state::{ArenaInstruction, Result};
use borsh::{BorshDeserialize, BorshSerialize};
use std::env;
use std::fs;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::str::FromStr;

use pyth_sdk_solana::state::SolanaPriceAccount;
use solana_client::{client_error::reqwest::blocking::get, rpc_client::RpcClient};
use solana_program::{
    entrypoint::deserialize, hash, native_token::LAMPORTS_PER_SOL, program_pack::Pack,
    pubkey::Pubkey, sysvar::rent,
};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    signature::Keypair,
    signer::keypair::read_keypair_file,
    signer::Signer,
    transaction::Transaction,
};
use solana_transaction_status::UiTransactionEncoding;
use spl_associated_token_account::get_associated_token_address;
use spl_associated_token_account::instruction::create_associated_token_account;
use spl_token::{instruction, state::Mint};

//const URL: &str = "https://api.mainnet-beta.solana.com";
//const URL: &str = "https://api.devnet.solana.com";
const URL: &str = "https://staging-rpc.dev2.eclipsenetwork.xyz";

const PROGRAM_KEY: &str = "9oQVwjBf5HQuRJFEv8yrLqoGYsR2jUDRUSHmDawpAdap";
use std::{thread, time};

fn main() {
    let args: Vec<String> = env::args().collect();
    let key_file = &args[1];
    let function = &args[2];

    if function == "init" {
        if let Err(err) = init(key_file) {
            eprintln!("{:?}", err);
            std::process::exit(1);
        }
    }
}

fn init(key_file: &String) -> Result<()> {
    // (2) Create a new Keypair for the new account
    let wallet = read_keypair_file(key_file).unwrap();

    // (3) Create RPC client to be used to talk to Solana cluster
    let connection = RpcClient::new(URL);

    let program = Pubkey::from_str(PROGRAM_KEY).unwrap();

    let sol_seed: u32 = 59957379;
    let data_seed: u32 = 7571427;

    let (data_account, _data_bump_seed) =
        Pubkey::find_program_address(&[&data_seed.to_le_bytes()], &program);

    let (sol_account, _sol_bump_seed) =
        Pubkey::find_program_address(&[&sol_seed.to_le_bytes()], &program);

    println!("data account {}", data_account.to_string());
    println!("sol account {}", sol_account.to_string());

    let account_vec = vec![
        AccountMeta::new(wallet.pubkey(), true),
        AccountMeta::new(data_account, false),
        AccountMeta::new(sol_account, false),
        AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
    ];

    let idx = Instruction::new_with_borsh(program, &(0 as u8), account_vec);

    // (7) Build transaction wrapping the create account instruction signed by both accounts
    let signers = [&wallet];
    let instructions = vec![idx];
    let recent_hash = connection.get_latest_blockhash()?;

    let txn = Transaction::new_signed_with_payer(
        &instructions,
        Some(&wallet.pubkey()),
        &signers,
        recent_hash,
    );

    // (8) Send transaction to the cluster and wait for confirmation
    let signature = connection.send_and_confirm_transaction(&txn)?;
    println!("signature: {}", signature);
    let response = connection.get_transaction(&signature, UiTransactionEncoding::Json)?;
    println!("result: {:#?}", response);

    Ok(println!("Success!"))
}
