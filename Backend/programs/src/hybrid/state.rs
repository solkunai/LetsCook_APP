use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountType;

use super::CollectionPlugin;

// This is the standard collection type
#[derive(Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct RandomFixedSupply {
    pub availability: Vec<u8>,
}

/// mints a new random hybrid every time
// just burns it when it is returned
#[derive(Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct RandomUnlimited {}

#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum CollectionMetaType {
    /// User gets a random nft from a fixed supply
    RandomFixedSupply,
    /// User gets a random nft from unlimited supply
    RandomUnlimited,
}

/// Definition of the collection variants
#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum CollectionMeta {
    /// User gets a random nft from a fixed supply
    RandomFixedSupply(RandomFixedSupply),
    /// User gets a random nft from unlimited supply
    RandomUnlimited(RandomUnlimited),
}

impl From<&CollectionMeta> for CollectionMetaType {
    fn from(collection_meta: &CollectionMeta) -> Self {
        match collection_meta {
            CollectionMeta::RandomFixedSupply(_) => CollectionMetaType::RandomFixedSupply,
            CollectionMeta::RandomUnlimited(_) => CollectionMetaType::RandomUnlimited,
        }
    }
}

pub enum CollectionKeys {
    Seller,
    TeamWallet,
    MintAddress,
    CollectionAddress,
    LENGTH,
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct NFTAssignment {
    pub account_type: AccountType,
    pub nft_address: Pubkey,
    pub random_address: Pubkey,
    pub nft_index: u32,
    pub status: u8,
    pub num_interactions: u32,
}

pub fn get_nft_assignment_data_size() -> usize {
    let encoded = to_vec(&NFTAssignment::default()).unwrap();

    encoded.len()
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct CollectionData {
    pub account_type: AccountType,
    pub launch_id: u64,

    pub collection_meta: CollectionMeta,
    pub plugins: Vec<CollectionPlugin>,
    // collection details
    pub collection_name: String,
    pub collection_symbol: String,
    pub collection_icon_url: String,
    pub collection_meta_url: String,

    // token swap details
    pub token_name: String,
    pub token_symbol: String,
    pub token_icon_url: String,
    pub token_decimals: u8,
    pub token_extensions: u8,

    // nft details
    pub nft_icon_url: String,
    pub nft_meta_url: String,
    pub nft_name: String,
    pub nft_type: String,

    pub banner_url: String,
    pub page_name: String,
    pub description: String,

    pub total_supply: u32,
    pub num_available: u32,
    pub swap_price: u64,
    pub swap_fee: u16,
    pub positive_votes: u32,
    pub negative_votes: u32,

    pub total_mm_buy_amount: u64,
    pub total_mm_sell_amount: u64,
    pub last_mm_reward_date: u32,

    pub socials: Vec<String>,
    pub flags: Vec<u8>,
    pub strings: Vec<String>,
    pub keys: Vec<Pubkey>,
}
