use crate::plugins::Plugin;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(PartialEq)]
pub enum Network {
    Devnet = 0,
    Mainnet = 1,
    Eclipse = 2,
}

pub enum MissionStatus {
    AtRest = 0,
    InProgress = 1,
    Success = 2,
    Failure = 3,
}

pub const NETWORK: Network = Network::Devnet;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq, Default)]
pub struct UserData {
    pub asset: Pubkey,
    pub mission_difficulty: u8,
    pub mission_status: u8,
    pub randoms_address: Pubkey,
    pub slot: u64,
    pub plugins: Vec<Plugin>,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq, Default)]
pub struct SummaryData {
    pub easy_games_played: [u32; 10],
    pub medium_games_played: [u32; 10],
    pub hard_games_played: [u32; 10],
}

#[derive(Default)]
pub struct SeedStruct {
    pub seed_prices: [u64; 10],
}
