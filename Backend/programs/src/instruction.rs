use borsh::{BorshDeserialize, BorshSerialize};

// Simple instruction enum for native Solana program
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum LaunchInstruction {
    Init,
    CreateLaunch { args: CreateArgs },
    BuyTickets { args: JoinArgs },
    CheckTickets,
    InitCookAMM,
    HypeVote { args: HypeVoteArgs },
    ClaimRefund,
    EditLaunch { args: EditArgs },
    ClaimTokens,
    SetName { args: SetNameArgs },
    SwapCookAMM { args: PlaceOrderArgs },
    GetMMRewardTokens { args: AddRewardsArgs },
    CloseAccount,
    LaunchCollection { args: LaunchCollectionArgs },
    ClaimNFT { args: ClaimNFTArgs },
    MintNFT,
    WrapNFT,
    EditCollection { args: EditCollectionArgs },
    MintRandomNFT,
    CreateOpenBookMarket,
    CreateRaydium { args: CreateRaydiumArgs },
    SwapRaydium { args: RaydiumSwapArgs },
    AddCookLiquidity { args: AddLiquidityArgs },
    RemoveCookLiquidity { args: RemoveLiquidityArgs },
    CreateUnverifiedListing { args: CreateUnverifiedListingArgs },
    CreateListing { args: CreateListingArgs },
    SwapRaydiumClassic { args: RaydiumSwapArgs },
    InitCookAMMExternal { args: InitAMMExternalArgs },
    CreateInstantLaunch { args: InstantLaunchArgs },
    AddTradeRewards { args: AddRewardsArgs },
    ListNFT { args: ListNFTArgs },
    UnlistNFT { args: UnlistNFTArgs },
    BuyNFT { args: BuyNFTArgs },
    UpdateRaffleImages { args: UpdateRaffleImagesArgs },
    BestPriceSwap { args: BestPriceSwapArgs },
}

// Instruction argument structs
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct CreateUnverifiedListingArgs {
    pub name: String,
    pub symbol: String,
    pub icon: String,
    pub uri: String,
    pub banner: String,
    pub description: String,
    pub website: String,
    pub twitter: String,
    pub telegram: String,
    pub discord: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct CreateListingArgs {
    pub provider: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct CreateArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub icon: String,
    pub banner: String,
    pub total_supply: u64,
    pub decimals: u8,
    pub launch_date: u64,
    pub close_date: u64,
    pub num_mints: u32,
    pub ticket_price: u64,
    pub page_name: String,
    pub transfer_fee: u16,
    pub max_transfer_fee: u64,
    pub extensions: u8,
    pub amm_provider: u8,
    pub launch_type: u8,
    pub whitelist_tokens: u64,
    pub whitelist_end: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct InstantLaunchArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub icon: String,
    pub banner: String,
    pub total_supply: u64,
    pub decimals: u8,
    pub ticket_price: u64,
    pub page_name: String,
    pub transfer_fee: u16,
    pub max_transfer_fee: u64,
    pub extensions: u8,
    pub amm_provider: u8,
    pub launch_type: u8,
    pub whitelist_tokens: u64,
    pub whitelist_end: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct JoinArgs {
    pub amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct EditArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub icon: String,
    pub banner: String,
    pub description: String,
    pub website: String,
    pub twitter: String,
    pub telegram: String,
    pub discord: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct HypeVoteArgs {
    pub vote: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct SetNameArgs {
    pub name: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct PlaceOrderArgs {
    pub side: u8,
    pub limit_price: u64,
    pub max_base_quantity: u64,
    pub max_quote_quantity: u64,
    pub order_type: u8,
    pub client_order_id: u64,
    pub limit: u16,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct CookSwapArgs {
    pub amount_0: u64,
    pub amount_1: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct RaydiumSwapArgs {
    pub amount_in: u64,
    pub minimum_amount_out: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct AddLiquidityArgs {
    pub amount_0: u64,
    pub amount_1: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct RemoveLiquidityArgs {
    pub amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct ClaimNFTArgs {
    pub index: u32,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct LaunchCollectionArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub icon: String,
    pub banner: String,
    pub description: String,
    pub website: String,
    pub twitter: String,
    pub telegram: String,
    pub discord: String,
    pub total_supply: u64,
    pub decimals: u8,
    pub launch_date: u64,
    pub close_date: u64,
    pub num_mints: u32,
    pub ticket_price: u64,
    pub page_name: String,
    pub transfer_fee: u16,
    pub max_transfer_fee: u64,
    pub extensions: u8,
    pub amm_provider: u8,
    pub launch_type: u8,
    pub whitelist_tokens: u64,
    pub whitelist_end: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct EditCollectionArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub icon: String,
    pub banner: String,
    pub description: String,
    pub website: String,
    pub twitter: String,
    pub telegram: String,
    pub discord: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct ListNFTArgs {
    pub price: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct UnlistNFTArgs {
    pub listing_id: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct BuyNFTArgs {
    pub listing_id: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct AddRewardsArgs {
    pub amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct InitAMMExternalArgs {
    pub amount_0: u64,
    pub amount_1: u64,
    pub open_time: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct CreateRaydiumArgs {
    pub amount_0: u64,
    pub amount_1: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct UpdateRaffleImagesArgs {
    pub icon: String,
    pub banner: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct BestPriceSwapArgs {
    pub input_mint: String,
    pub output_mint: String,
    pub amount_in: u64,
    pub minimum_amount_out: u64,
    pub slippage_bps: u16, // Slippage in basis points (e.g., 100 = 1%)
}