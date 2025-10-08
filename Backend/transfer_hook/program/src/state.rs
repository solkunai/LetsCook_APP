use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

pub fn get_amm_seeds<'a>(base_mint: Pubkey, quote_mint: Pubkey, amm_seeds: &mut Vec<Pubkey>) {
    let base_first = base_mint.to_string() < quote_mint.to_string();

    if base_first {
        amm_seeds.push(base_mint);
        amm_seeds.push(quote_mint)
    } else {
        amm_seeds.push(quote_mint);
        amm_seeds.push(base_mint);
    }
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct AMM {
    pub account_type: u8,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub base_key: Pubkey,
    pub quote_key: Pubkey,
    pub fee: u16,
    pub num_data_accounts: u32,
    pub last_price: f32,
    pub transferring: u8,
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

pub enum LaunchKeys {
    Seller,
    TeamWallet,
    MintAddress,
    WSOLAddress,
    LENGTH,
}

/// mints a new random hybrid every time
// just burns it when it is returned
#[derive(Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct TempPlugin {}

#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum LaunchPluginType {
    /// Standard raffle launch
    TempPlugin,
}

/// Definition of the collection variants
#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum LaunchPlugin {
    /// User gets a random nft from a fixed supply
    TempPlugin(TempPlugin),
}

impl From<&LaunchPlugin> for LaunchPluginType {
    fn from(collection_meta: &LaunchPlugin) -> Self {
        match collection_meta {
            LaunchPlugin::TempPlugin(_) => LaunchPluginType::TempPlugin,
        }
    }
}

/// mints a new random hybrid every time
// just burns it when it is returned
#[derive(Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct Raffle {}

#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum LaunchMetaType {
    /// Standard raffle launch
    Raffle,
}

/// Definition of the collection variants
#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum LaunchMeta {
    /// User gets a random nft from a fixed supply
    Raffle(Raffle),
}

impl From<&LaunchMeta> for LaunchMetaType {
    fn from(collection_meta: &LaunchMeta) -> Self {
        match collection_meta {
            LaunchMeta::Raffle(_) => LaunchMetaType::Raffle,
        }
    }
}

// 79 bytes
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct LaunchData {
    pub account_type: u8,
    pub launch_meta: LaunchMeta,
    pub plugins: Vec<LaunchPlugin>,
    pub launch_id: u64,
    pub last_interaction: i64,
    pub num_interactions: u16,
    pub name: String,
    pub symbol: String,
    pub icon_url: String,
    pub meta_url: String,
    pub banner_url: String,
    pub page_name: String,
    pub description: String,

    pub total_supply: u64,
    pub decimals: u8,
    pub num_mints: u32,
    pub ticket_price: u64,
    pub minimum_liquidity: u64,
    pub launch_date: u64,
    pub end_date: u64,
    pub tickets_sold: u32,
    pub ticket_claimed: u32,
    pub mints_won: u32,
    pub positive_votes: u32,
    pub negative_votes: u32,

    pub total_mm_buy_amount: u64,
    pub total_mm_sell_amount: u64,
    pub last_mm_reward_date: u32,

    pub socials: Vec<String>,
    pub distribution: Vec<u8>,
    pub flags: Vec<u8>,
    pub strings: Vec<String>,
    pub keys: Vec<Pubkey>,
}
