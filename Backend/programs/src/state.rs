use borsh::{to_vec, BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

pub const fn get_fee_amount(network: Network) -> u64 {
    match network {
        Network::Eclipse => 100_000,
        _ => 2_000_000,
    }
}

#[derive(PartialEq)]
pub enum Network {
    Devnet = 0,
    Mainnet = 1,
    Eclipse = 2,
}

// Network is determined at compile time via feature flags
// Use: cargo build --features mainnet or --features eclipse
#[cfg(feature = "mainnet")]
pub const NETWORK: Network = Network::Mainnet;

#[cfg(feature = "eclipse")]
pub const NETWORK: Network = Network::Eclipse;

#[cfg(not(any(feature = "mainnet", feature = "eclipse")))]
pub const NETWORK: Network = Network::Devnet;

pub const FEE_AMOUNT: u64 = get_fee_amount(NETWORK);

pub enum Extensions {
    None = 0,
    TransferFee = 1,
    PermanentDelegate = 2,
    TransferHook = 4,
}

#[derive(Default)]
pub struct SeedStruct {
    pub seed_prices: [u64; 10],
}

pub const N_RANDOMS: usize = 200;

pub struct RollResult {
    pub rolls: [f64; N_RANDOMS],
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct OraoRandom {
    pub values: [u8; 64],
}

pub struct CollectionDetails {
    pub name: String,
    pub index: u32,
    pub uri: String,
    pub pda: u32,
}

pub struct TokenDetails {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub pda: u32,
    pub decimals: u8,
    pub total_supply: u64,
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum AccountType {
    #[default]
    Launch,
    Program,
    User,
    Join,
    MMUserData,
    MMLaunchData,
    AMM,
    TimeSeries,
    CollectionLaunch,
    NFTAssignment,
    NFTLookup,
    Listing,
    UnverifiedListing,
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq, Copy)]
pub enum GameSpeed {
    #[default]
    Fast,
    Slow,
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct ProgramData {
    pub account_type: AccountType,
    pub num_launches: u64,
}


// achievement enums
pub enum Achievement32 {
    NumMints,
    NumWraps,
    LENGTH,
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum LaunchMeta {
    #[default]
    Raffle,
    FCFS,
    IDO {
        token_fraction_distributed: u64,
        tokens_distributed: u64,
    },
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct LaunchData {
    pub account_type: AccountType,
    pub launch_meta: LaunchMeta,
    pub plugins: Vec<u8>, // Simplified for now
    pub last_interaction: u64,
    pub num_interactions: u16,
    pub page_name: String,
    pub listing: String, // Pubkey as string
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
    pub buffer3: u64,
    pub distribution: Vec<u64>,
    pub flags: Vec<u8>,
    pub strings: Vec<String>,
    pub keys: Vec<String>,
    pub creator: Pubkey, // Creator of the launch
    pub upvotes: u32,    // Number of upvotes
    pub downvotes: u32,  // Number of downvotes
    pub is_tradable: bool, // Whether the token can be traded (raffle graduation)
    pub tokens_sold: u64, // Tokens sold (circulating supply) for instant launches - pump.fun style bonding curve
    pub is_graduated: bool, // Whether instant launch has graduated to AMM (bonding curve ended)
    pub graduation_threshold: u64, // Market cap threshold for graduation (in lamports, default ~$85k)
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct UserStats {
    pub flags: Vec<u8>,
    pub values: Vec<u32>,
    pub amounts: Vec<u64>,
    pub achievements_earnt: Vec<u8>,
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct UserData {
    pub account_type: AccountType,
    pub user_key: Pubkey,
    pub user_name: String,
    pub total_points: u32,
    pub votes: Vec<u64>,
    pub stats: UserStats,
}


#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct MMUserData {
    pub account_type: AccountType,
    pub user_key: Pubkey,
    pub amm_key: Pubkey,
    pub date: u32,
    pub buy_amount: u64,
    pub sell_amount: u64,
}


#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct MMLaunchData {
    pub account_type: AccountType,
    pub amm_key: Pubkey,
    pub date: u32,
    pub token_rewards: u64,
    pub buy_amount: u64,
    pub amount_distributed: u64,
    pub fraction_distributed: f64,
}


pub enum Socials {
    Website,
    Twitter,
    Telegram,
    Discord,
    LENGTH,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct InitAMM {
    pub descriminator: [u8; 8],
    pub amount_0: u64,
    pub amount_1: u64,
    pub open_time: u64,
}


#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct OraoRequest {
    pub descriminator: [u8; 8],
    pub seed: [u8; 32],
}


pub fn get_arena_data_size() -> usize {
    let encoded = to_vec(&ProgramData::default()).unwrap();
    encoded.len()
}

pub fn get_user_data_size() -> usize {
    let encoded = to_vec(&UserData::default()).unwrap();
    encoded.len()
}

pub fn get_mm_user_data_size() -> usize {
    let encoded = to_vec(&MMUserData::default()).unwrap();
    encoded.len()
}

pub fn get_mm_launch_data_size() -> usize {
    let encoded = to_vec(&MMLaunchData::default()).unwrap();
    encoded.len()
}
