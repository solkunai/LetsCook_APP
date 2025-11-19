use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

use crate::state::AccountType;

use super::{LaunchMeta, LaunchPlugin};

pub enum Distribution {
    Raffle,
    LP,
    MMRewards,
    LPRewards,
    Airdrops,
    Team,
    Other,
    LENGTH,
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum TicketStatus {
    #[default]
    Available,
    LosingRefunded,
    WinningClaimed,
    FullyRefunded,
}

pub fn get_program_dist(distribution: Vec<u8>) -> f64 {
    let total =
        distribution[Distribution::Raffle as usize] + distribution[Distribution::LP as usize] + distribution[Distribution::MMRewards as usize];

    return (total as f64) / 100.0;
}

pub fn get_user_dist(distribution: Vec<u8>) -> f64 {
    let program_total = get_program_dist(distribution);

    return 1.0 - program_total;
}

pub enum LaunchFlags {
    MintedToUser,
    LaunchFailed,
    LPState,
    TokenProgramVersion,
    BookProvider,
    AMMProvider,
    Extensions,
    Transferring,
    LENGTH,
}

pub enum LaunchStrings {
    LENGTH,
}

pub enum LaunchKeys {
    Seller,
    TeamWallet,
    WSOLAddress,
    CookDEXPool,
    RaydiumPool,
    LENGTH,
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct Listing {
    pub account_type: AccountType,
    pub id: u64,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub icon_url: String,
    pub meta_url: String,
    pub banner_url: String,
    pub description: String,

    // hype voting
    pub positive_votes: u32,
    pub negative_votes: u32,

    pub socials: Vec<String>,
}

// 79 bytes
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct LaunchData {
    pub account_type: AccountType,
    pub launch_meta: LaunchMeta,
    pub plugins: Vec<LaunchPlugin>,
    pub last_interaction: i64,
    pub num_interactions: u16,

    pub page_name: String,
    pub listing: Pubkey,
    pub total_supply: u64,
    pub num_mints: u32,
    pub ticket_price: u64,
    pub minimum_liquidity: u64,
    pub launch_date: u64,
    pub end_date: u64,
    pub tickets_sold: u32,
    pub ticket_claimed: u32,
    pub mints_won: u32,

    pub buffer1: u64,
    pub buffer2: u64,
    pub buffer3: u32,

    pub distribution: Vec<u8>,
    pub flags: Vec<u8>,
    pub strings: Vec<String>,
    pub keys: Vec<Pubkey>,
    
    // Instant launch fields (pump.fun-style bonding curve)
    pub is_tradable: bool, // Whether the token can be traded (raffle graduation)
    pub tokens_sold: u64, // Tokens sold (circulating supply) for instant launches - pump.fun style bonding curve
    pub is_graduated: bool, // Whether instant launch has graduated to AMM (bonding curve ended)
    pub graduation_threshold: u64, // Market cap threshold for graduation (in lamports, default ~$85k)
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct JoinData {
    pub account_type: AccountType,
    pub joiner_key: Pubkey,
    pub page_name: String,
    pub num_tickets: u16,
    pub num_tickets_checked: u16,
    pub num_winning_tickets: u16,
    pub ticket_status: TicketStatus,
    pub random_address: Pubkey,
    pub last_slot: u64,
    pub order_id: String, // Transaction signature of the ticket purchase
}

pub fn get_join_data_size() -> usize {
    let encoded = to_vec(&JoinData::default()).unwrap();

    encoded.len()
}
