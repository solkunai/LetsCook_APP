use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(PartialEq)]
pub enum Network {
    Devnet = 0,
    Mainnet = 1,
    Eclipse = 2,
}

pub const NETWORK: Network = Network::Eclipse;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct Listing {
    pub collection: Pubkey,
    pub asset: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct Summary {
    pub num_listings: u32,
}
