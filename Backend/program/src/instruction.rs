use borsh::{BorshDeserialize, BorshSerialize};
use shank::{ShankContext, ShankInstruction};
use spl_discriminator::SplDiscriminate;

use crate::hybrid::CollectionMetaType;

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
    pub description: String,
    pub website: String,
    pub twitter: String,
    pub telegram: String,
    pub discord: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct EditArgs {
    pub description: String,
    pub distribution: Vec<u8>,
    pub website: String,
    pub twitter: String,
    pub telegram: String,
    pub discord: String,
    pub amm_fee: u16,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct JoinArgs {
    pub num_tickets: u16,
    pub seed: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct VoteArgs {
    pub launch_type: u8,
    pub vote: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct MoveArgs {
    pub encrypted_move: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct SetNameArgs {
    pub name: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct PlaceOrderArgs {
    pub side: u8,
    pub in_amount: u64,
    pub data: Vec<u8>,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct InitRaydiumArgs {
    pub descriminator: [u8; 8],
    pub init_amount_0: u64,
    pub init_amount_1: u64,
    pub open_time: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct InitCookAMMExternalArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub icon: String,
    pub website: String,
    pub twitter: String,
    pub telegram: String,
    pub discord: String,
    pub base_amount: u64,
    pub quote_amount: u64,
    pub wrap: u8,
    pub burn_lp: u8,
    pub low_liqudity: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct CookSwapArgs {
    pub side: u8,
    pub in_amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct RaydiumSwapArgs {
    pub side: u8,
    pub discriminator: [u8; 8],
    pub in_amount: u64,
    pub out_amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct CancelOrderArgs {
    pub side: u8,
    pub in_amount: u64,
    pub data: Vec<u8>,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct GetMMRewardArgs {
    pub date: u32,
    pub amm_provider: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct AddTradeRewardsArgs {
    pub amount: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct Attribute {
    pub name: String,
    pub min: String,
    pub max: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct LaunchCollectionArgs {
    pub collection_type: CollectionMetaType,
    pub collection_name: String,
    pub collection_symbol: String,
    pub collection_uri: String,
    pub collection_icon: String,
    pub token_name: String,
    pub token_symbol: String,
    pub token_icon: String,
    pub token_decimals: u8,
    pub token_extensions: u8,
    pub nft_uri: String,
    pub nft_icon: String,
    pub nft_name: String,
    pub nft_type: String,
    pub banner: String,
    pub collection_size: u32,
    pub swap_price: u64,
    pub page_name: String,
    pub swap_fee: u16,
    pub nft_extensions: u8,
    pub nft_probability: u16,
    pub attributes: Vec<Attribute>,
    pub whitelist_tokens: u64,
    pub whitelist_end: u64,
    pub mint_only: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct EditCollectionArgs {
    pub description: String,
    pub website: String,
    pub twitter: String,
    pub telegram: String,
    pub discord: String,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct ClaimNFTArgs {
    pub seed: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct ListNFTArgs {
    pub price: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct UnlistNFTArgs {
    pub index: u32,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct BuyNFTArgs {
    pub index: u32,
}

#[derive(ShankContext, ShankInstruction, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum LaunchInstruction {
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "cook_data", desc = "Data account for lets cook")]
    #[account(2, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(3, name = "system_program", desc = "System program")]
    Init,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "listing", desc = "Listing data account")]
    #[account(2, writable, name = "launch_data", desc = "Launch data account")]
    #[account(3, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(4, writable, name = "launch_quote", desc = "launch quote account")]
    #[account(5, writable, name = "cook_data", desc = "Data account for lets cook")]
    #[account(6, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(7, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(8, writable, name = "cook_base_token", desc = "base ATA for LC")]
    #[account(9, writable, name = "team", desc = "team account for launch")]
    #[account(10, name = "whitelist", desc = "whitelist token")]
    #[account(11, name = "quote_token_program", desc = "token program for quote")]
    #[account(12, name = "base_token_program", desc = "token progrma for base token")]
    #[account(13, name = "associated_token", desc = "associated token program")]
    #[account(14, name = "system_program", desc = "system program")]
    #[account(15, optional, name = "delegate", desc = "PD account")]
    #[account(16, optional, name = "hook", desc = "TH account")]
    CreateLaunch { args: CreateArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "join_data", desc = "Users join account")]
    #[account(3, writable, name = "launch_data", desc = "Launch data account")]
    #[account(4, writable, name = "launch_quote", desc = "launch quote account")]
    #[account(5, writable, name = "fees", desc = "launch fees account")]
    #[account(6, name = "system_program", desc = "system program")]
    #[account(7, name = "quote_token_program", desc = "token program for quote")]
    #[account(8, name = "orao_random", desc = "orao random data")]
    #[account(9, name = "orao_treasury", desc = "orao treasury")]
    #[account(10, name = "orao_network", desc = "orao network")]
    #[account(11, name = "orao_program", desc = "orao program")]
    #[account(12, name = "pda", desc = "cook pda")]
    #[account(13, name = "whitelist_mint", desc = "whitelist mint")]
    #[account(14, name = "whitelist_account", desc = "whitelist account")]
    #[account(15, name = "whitelist_token_program", desc = "whitelist token program")]
    #[account(16, name = "listing", desc = "Listing account")]
    BuyTickets { args: JoinArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "join_data", desc = "Users join account")]
    #[account(3, writable, name = "launch_data", desc = "Launch data account")]
    #[account(4, name = "orao_random", desc = "Orao randoms account")]
    #[account(5, name = "system_program", desc = "System program")]
    CheckTickets,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "listing", desc = "Listing data account")]
    #[account(3, writable, name = "launch_data", desc = "Launch data account")]
    #[account(4, writable, name = "team_token", desc = "team ATA")]
    #[account(5, writable, name = "team", desc = "team account for launch")]
    #[account(6, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(7, writable, name = "amm", desc = "AMM data account")]
    #[account(8, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(9, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(10, writable, name = "lp_token_mint", desc = "AMM LP token mint")]
    #[account(11, writable, name = "cook_base_token", desc = "base ATA for LC")]
    #[account(12, writable, name = "cook_quote_token", desc = "launch quote account")]
    #[account(13, writable, name = "amm_base", desc = "AMM base account")]
    #[account(14, writable, name = "amm_quote", desc = "AMM quote account")]
    #[account(15, writable, name = "trade_to_earn", desc = "AMM T2E account")]
    #[account(16, writable, name = "price_data", desc = "Price Data for AMM")]
    #[account(17, name = "quote_token_program", desc = "token program for quote")]
    #[account(18, name = "base_token_program", desc = "token progrma for base token")]
    #[account(19, name = "associated_token", desc = "associated token program")]
    #[account(20, name = "system_program", desc = "system program")]
    InitCookAMM,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "launch_data", desc = "Launch data account")]
    #[account(3, name = "system_program", desc = "System program")]
    HypeVote { args: VoteArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "join_data", desc = "Users join account")]
    #[account(2, writable, name = "launch_data", desc = "Launch data account")]
    #[account(3, writable, name = "launch_quote", desc = "launch quote account")]
    #[account(4, writable, name = "temp_wsol", desc = "temp wsol account")]
    #[account(5, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(6, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(7, name = "quote_token_program", desc = "token program for quote")]
    #[account(8, name = "system_program", desc = "system program")]
    ClaimRefund,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "listing", desc = "Listing data account")]
    #[account(3, writable, name = "launch_data", desc = "Launch data account")]
    #[account(4, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(5, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(6, writable, name = "amm", desc = "AMM data account")]
    #[account(7, writable, name = "amm_pool", desc = "AMM pool account")]
    #[account(8, writable, name = "amm_quote", desc = "AMM quote account")]
    #[account(9, writable, name = "amm_base", desc = "AMM base account")]
    #[account(10, writable, name = "trade_to_earn", desc = "AMM T2E account")]
    #[account(11, writable, name = "lp_token_mint", desc = "AMM LP token mint")]
    #[account(12, name = "system_program", desc = "system program")]
    #[account(13, name = "quote_token_program", desc = "token program for quote")]
    #[account(14, name = "base_token_program", desc = "token program for base")]
    #[account(15, name = "associated_token", desc = "associated token program")]
    EditLaunch { args: EditArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "join_data", desc = "Users join account")]
    #[account(3, writable, name = "launch_data", desc = "Launch data account")]
    #[account(4, writable, name = "launch_quote", desc = "launch quote account")]
    #[account(5, writable, name = "temp_wsol", desc = "temp wsol account")]
    #[account(6, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(7, writable, name = "cook_base_token", desc = "base ATA for LC")]
    #[account(8, writable, name = "user_base", desc = "user base ATA")]
    #[account(9, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(10, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(11, name = "listing", desc = "Listing account")]
    #[account(12, name = "quote_token_program", desc = "token program for quote")]
    #[account(13, name = "base_token_program", desc = "token program for base")]
    #[account(14, name = "associated_token", desc = "associated token program")]
    #[account(15, name = "system_program", desc = "system program")]
    ClaimTokens,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, name = "system_program", desc = "System program")]
    SetName { args: SetNameArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "user_base", desc = "user base ATA")]
    #[account(3, writable, name = "temp_wsol", desc = "temp wsol account")]
    #[account(4, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(5, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(6, writable, name = "amm", desc = "AMM data account")]
    #[account(7, writable, name = "amm_base", desc = "AMM base account")]
    #[account(8, writable, name = "amm_quote", desc = "AMM quote account")]
    #[account(9, writable, name = "trade_to_earn", desc = "AMM T2E account")]
    #[account(10, writable, name = "launch_rewards", desc = "launch MM rewards")]
    #[account(11, writable, name = "user_rewards", desc = "user MM rewards")]
    #[account(12, writable, name = "price_data", desc = "Price Data for AMM")]
    #[account(13, name = "quote_token_program", desc = "token program for quote")]
    #[account(14, name = "base_token_program", desc = "token progrma for base token")]
    #[account(15, name = "associated_token", desc = "associated token program")]
    #[account(16, name = "system_program", desc = "system program")]
    #[account(17, name = "cook_fees", desc = "fees account")]
    SwapCookAMM { args: PlaceOrderArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_pda", desc = "Users PDA account")]
    #[account(2, writable, name = "user_base_token", desc = "user base ATA")]
    #[account(3, writable, name = "trade_to_earn", desc = "base ATA for LC")]
    #[account(4, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(5, writable, name = "amm", desc = "Launch data account")]
    #[account(6, writable, name = "launch_rewards", desc = "launch MM rewards")]
    #[account(7, writable, name = "user_rewards", desc = "user MM rewards")]
    #[account(8, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(9, writable, name = "quote_token_mint", desc = "base token mint")]
    #[account(10, name = "base_token_program", desc = "token progrma for base token")]
    #[account(11, name = "system_program", desc = "system program")]
    GetMMRewardTokens { args: GetMMRewardArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, name = "system_program", desc = "System program")]
    CloseAccount,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "collection_data", desc = "Collection data")]
    #[account(2, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(3, writable, name = "collection", desc = "collection account")]
    #[account(4, writable, name = "token_mint", desc = "lets cook PDA")]
    #[account(5, writable, name = "team", desc = "team account for launch")]
    #[account(6, optional, name = "whitelist_mint", desc = "whitelist mint")]
    #[account(7, name = "system_program", desc = "system program")]
    #[account(8, name = "core_program", desc = "core program")]
    LaunchCollection { args: LaunchCollectionArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "assignment", desc = "assignment data")]
    #[account(3, writable, name = "collection_data", desc = "Collection data")]
    #[account(4, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(5, writable, name = "token_mint", desc = "lets cook PDA")]
    #[account(6, writable, name = "user_token", desc = "lets cook PDA")]
    #[account(7, writable, name = "token_destination", desc = "destination token account")]
    #[account(8, writable, name = "collection", desc = "collection account")]
    #[account(9, writable, name = "cook_fees", desc = "cook fees")]
    #[account(10, writable, name = "team_wallet", desc = "team wallet")]
    #[account(11, name = "system_program", desc = "system program")]
    #[account(12, name = "token_program", desc = "token program for base")]
    #[account(13, name = "orao_random", desc = "token program for base")]
    #[account(14, name = "orao_treasury", desc = "token program for base")]
    #[account(15, name = "orao_network", desc = "token program for base")]
    #[account(16, name = "orao_program", desc = "token program for base")]
    #[account(17, optional, writable, name = "whitelist_mint", desc = "whitelist mint")]
    #[account(18, optional, writable, name = "whitelist_account", desc = "whitelist account")]
    #[account(19, optional, name = "whitelist_token_program", desc = "whitelist token program")]
    ClaimNFT { args: ClaimNFTArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "assignment", desc = "assignment data")]
    #[account(2, writable, name = "collection_data", desc = "Collection data")]
    #[account(3, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(4, writable, name = "asset", desc = "asset account")]
    #[account(5, writable, name = "collection", desc = "collection account")]
    #[account(6, writable, name = "team", desc = "team account")]
    #[account(7, writable, name = "token_mint", desc = "token mint")]
    #[account(8, writable, name = "cook_token", desc = "cook token account")]
    #[account(9, writable, name = "user_token", desc = "user token account")]
    #[account(10, writable, name = "team_token", desc = "team token account")]
    #[account(11, name = "system_program", desc = "system program")]
    #[account(12, name = "core_program", desc = "core program")]
    #[account(13, name = "orao_random", desc = "core program")]
    #[account(14, name = "token_program", desc = "token program for base")]
    MintNFT,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "collection_data", desc = "Collection data")]
    #[account(3, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(4, writable, name = "token_mint", desc = "token mint")]
    #[account(5, writable, name = "user_token", desc = "user ATA")]
    #[account(6, writable, name = "cook_token", desc = "lets cook ATA")]
    #[account(7, writable, name = "team_token", desc = "team ATA")]
    #[account(8, writable, name = "asset", desc = "asset account")]
    #[account(9, writable, name = "collection", desc = "collection account")]
    #[account(10, name = "token_program", desc = "token program for base")]
    #[account(11, name = "associated_token", desc = "associated token program")]
    #[account(12, name = "system_program", desc = "system program")]
    #[account(13, name = "core_program", desc = "core program")]
    WrapNFT,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "collection_data", desc = "Collection data")]
    #[account(3, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(4, writable, name = "cook_data", desc = "Data account for lets cook")]
    #[account(5, writable, name = "team", desc = "team account for launch")]
    #[account(6, writable, name = "token_mint", desc = "token mint")]
    #[account(7, writable, name = "team_token", desc = "team ATA")]
    #[account(8, writable, name = "cook_token", desc = "lets cook ATA")]
    #[account(9, name = "associated_token", desc = "associated token program")]
    #[account(10, name = "system_program", desc = "system program")]
    #[account(11, name = "token_program", desc = "token program")]
    EditCollection { args: EditCollectionArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "assignment", desc = "assignment data")]
    #[account(2, writable, name = "collection_data", desc = "Collection data")]
    #[account(3, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(4, writable, name = "asset", desc = "asset account")]
    #[account(5, writable, name = "collection", desc = "collection account")]
    #[account(6, writable, name = "team", desc = "team account")]
    #[account(7, writable, name = "token_mint", desc = "token mint")]
    #[account(8, writable, name = "cook_token", desc = "cook token account")]
    #[account(9, writable, name = "user_token", desc = "user token account")]
    #[account(10, writable, name = "team_token", desc = "team token account")]
    #[account(11, name = "system_program", desc = "system program")]
    #[account(12, name = "core_program", desc = "core program")]
    #[account(13, name = "orao_random", desc = "core program")]
    #[account(14, name = "token_program", desc = "token program for base")]
    MintRandomNFT,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "launch_data", desc = "Launch data account")]
    #[account(2, writable, name = "market_base", desc = "market base ATA")]
    #[account(3, writable, name = "market_quote", desc = "market quote ATA")]
    #[account(4, writable, name = "market_id", desc = "market id")]
    #[account(5, writable, name = "request_queue", desc = "request queue")]
    #[account(6, writable, name = "event_queue", desc = "event queue")]
    #[account(7, writable, name = "bids", desc = "market bids")]
    #[account(8, writable, name = "asks", desc = "market asks")]
    #[account(9, name = "system_program", desc = "system program")]
    #[account(10, name = "market_program", desc = "market program")]
    CreateOpenBookMarket,
    #[account(0, writable, signer, name = "user", desc = "token program for base")]
    #[account(1, writable, name = "user_data", desc = "token program for base")]
    #[account(2, name = "listing", desc = "Listing data account")]
    #[account(3, writable, name = "launch_data", desc = "Launch data account")]
    #[account(4, writable, name = "team", desc = "team account for launch")]
    #[account(5, writable, name = "team_token", desc = "team account for launch")]
    #[account(6, writable, name = "pda", desc = "token program for base")]
    #[account(7, writable, name = "amm_config", desc = "pool id")]
    #[account(8, writable, name = "authority", desc = "pool authority")]
    #[account(9, writable, name = "state", desc = "open orders")]
    #[account(10, writable, name = "mint_0", desc = "target orders")]
    #[account(11, writable, name = "mint_1", desc = "pool base ATA")]
    #[account(12, writable, name = "lp_mint", desc = "pool quote ATA")]
    #[account(13, writable, name = "user_0", desc = "market program")]
    #[account(14, writable, name = "user_1", desc = "market id")]
    #[account(15, writable, name = "user_lp", desc = "market bids")]
    #[account(16, writable, name = "amm_0", desc = "market asks")]
    #[account(17, writable, name = "amm_1", desc = "event queue")]
    #[account(18, writable, name = "fees", desc = "market base ATA")]
    #[account(19, writable, name = "observation_state", desc = "market quote ATA")]
    #[account(20, writable, name = "lp_token_program", desc = "market authority")]
    #[account(21, writable, name = "token_program_0", desc = "user in ATA")]
    #[account(22, writable, name = "token_program_1", desc = "user out ATA")]
    #[account(23, writable, name = "associated", desc = "Users account, signer")]
    #[account(24, writable, name = "system_program", desc = "raydium program")]
    #[account(25, writable, name = "rent_program", desc = "launch MM rewards")]
    #[account(26, writable, name = "raydium_program", desc = "user MM rewards")]
    #[account(27, writable, name = "temp_wsol", desc = "user MM rewards")]
    #[account(28, writable, name = "trade_to_earn", desc = "user MM rewards")]
    #[account(29, writable, name = "cook_amm", desc = "user MM rewards")]
    CreateRaydium { args: InitRaydiumArgs },
    #[account(0, writable, signer, name = "user", desc = "token program for base")]
    #[account(1, writable, name = "authority", desc = "pool id")]
    #[account(2, writable, name = "amm_config", desc = "pool authority")]
    #[account(3, writable, name = "pool_state", desc = "pool authority")]
    #[account(4, writable, name = "user_input", desc = "open orders")]
    #[account(5, writable, name = "user_output", desc = "target orders")]
    #[account(6, writable, name = "amm_input", desc = "pool base ATA")]
    #[account(7, writable, name = "amm_output", desc = "pool quote ATA")]
    #[account(8, name = "token_program_input", desc = "market program")]
    #[account(9, name = "token_program_output", desc = "market id")]
    #[account(10, name = "mint_input", desc = "market bids")]
    #[account(11, name = "mint_output", desc = "market asks")]
    #[account(12, writable, name = "observation", desc = "event queue")]
    #[account(13, name = "raydium_program", desc = "raydium program")]
    #[account(14, writable, name = "launch_rewards", desc = "launch MM rewards")]
    #[account(15, writable, name = "user_rewards", desc = "user MM rewards")]
    #[account(16, writable, name = "cook_amm", desc = "Cook AMM data account")]
    #[account(17, name = "associated_token", desc = "associated token program")]
    #[account(18, name = "system_program", desc = "system program")]
    SwapRaydium { args: RaydiumSwapArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(2, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(3, writable, name = "lp_token_mint", desc = "AMM LP token mint")]
    #[account(4, writable, name = "temp_wsol", desc = "temp wsol account")]
    #[account(5, writable, name = "user_base", desc = "user base ATA")]
    #[account(6, writable, name = "user_lp", desc = "user lp ATA")]
    #[account(7, writable, name = "amm", desc = "AMM data account")]
    #[account(8, writable, name = "amm_base", desc = "AMM base account")]
    #[account(9, writable, name = "amm_quote", desc = "AMM quote account")]
    #[account(10, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(11, name = "quote_token_program", desc = "token program for quote")]
    #[account(12, name = "base_token_program", desc = "token progrma for base token")]
    #[account(13, name = "associated_token", desc = "associated token program")]
    #[account(14, name = "system_program", desc = "system program")]
    AddCookLiquidity { args: CookSwapArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(2, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(3, writable, name = "lp_token_mint", desc = "AMM LP token mint")]
    #[account(4, writable, name = "temp_wsol", desc = "temp wsol account")]
    #[account(5, writable, name = "user_base", desc = "user base ATA")]
    #[account(6, writable, name = "user_lp", desc = "user lp ATA")]
    #[account(7, writable, name = "amm", desc = "AMM data account")]
    #[account(8, writable, name = "amm_base", desc = "AMM base account")]
    #[account(9, writable, name = "amm_quote", desc = "AMM quote account")]
    #[account(10, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(11, name = "quote_token_program", desc = "token program for quote")]
    #[account(12, name = "base_token_program", desc = "token progrma for base token")]
    #[account(13, name = "associated_token", desc = "associated token program")]
    #[account(14, name = "system_program", desc = "system program")]
    RemoveCookLiquidity { args: CookSwapArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users Data account, signer")]
    #[account(2, writable, name = "listing", desc = "Listing data account")]
    #[account(3, writable, name = "cook_data", desc = "Data account for lets cook")]
    #[account(4, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(5, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(6, name = "system_program", desc = "system program")]
    CreateUnverifiedListing { args: CreateUnverifiedListingArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, name = "creator", desc = "Creators account, signer")]
    #[account(2, name = "creator_data", desc = "Creators data account, signer")]
    #[account(3, writable, name = "unverified", desc = "Listing data account")]
    #[account(4, optional, writable, name = "listing", desc = "Listing data account")]
    #[account(5, writable, name = "cook_data", desc = "Data account for lets cook")]
    #[account(6, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(7, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(8, optional, writable, name = "amm", desc = "AMM data account")]
    #[account(9, optional, writable, name = "amm_pool", desc = "AMM pool account")]
    #[account(10, writable, name = "quote_mint", desc = "quote token mint")]
    #[account(11, writable, name = "amm_quote", desc = "AMM quote account")]
    #[account(12, writable, name = "amm_base", desc = "AMM base account")]
    #[account(13, writable, name = "lp_token_mint", desc = "AMM LP token mint")]
    #[account(14, name = "system_program", desc = "system program")]
    CreateListing { args: CreateListingArgs },
    #[account(0, name = "token_program", desc = "token program for base")]
    #[account(1, writable, name = "pool_id", desc = "pool id")]
    #[account(2, writable, name = "pool_authority", desc = "pool authority")]
    #[account(3, writable, name = "open_orders", desc = "open orders")]
    #[account(4, writable, name = "target_orders", desc = "target orders")]
    #[account(5, writable, name = "pool_base", desc = "pool base ATA")]
    #[account(6, writable, name = "pool_quote", desc = "pool quote ATA")]
    #[account(7, name = "market_program", desc = "market program")]
    #[account(8, writable, name = "market_id", desc = "market id")]
    #[account(9, writable, name = "bids", desc = "market bids")]
    #[account(10, writable, name = "asks", desc = "market asks")]
    #[account(11, writable, name = "event_queue", desc = "event queue")]
    #[account(12, writable, name = "market_base", desc = "market base ATA")]
    #[account(13, writable, name = "market_quote", desc = "market quote ATA")]
    #[account(14, writable, name = "market_authority", desc = "market authority")]
    #[account(15, writable, name = "user_in", desc = "user in ATA")]
    #[account(16, writable, name = "user_out", desc = "user out ATA")]
    #[account(17, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(18, name = "raydium_program", desc = "raydium program")]
    #[account(19, writable, name = "cook_amm", desc = "Cook AMM Account")]
    #[account(20, writable, name = "launch_rewards", desc = "launch MM rewards")]
    #[account(21, writable, name = "user_rewards", desc = "user MM rewards")]
    #[account(22, writable, name = "listing", desc = "Listing data account")]
    #[account(23, writable, name = "in_token_mint", desc = "in token mint")]
    #[account(24, writable, name = "out_token_mint", desc = "out token mint")]
    #[account(25, name = "associated_token", desc = "associated token program")]
    #[account(26, name = "system_program", desc = "system program")]
    SwapRaydiumClassic { args: RaydiumSwapArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "listing", desc = "Listing data account")]
    #[account(3, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(4, writable, name = "amm", desc = "AMM data account")]
    #[account(5, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(6, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(7, writable, name = "lp_token_mint", desc = "AMM LP token mint")]
    #[account(8, writable, name = "user_base", desc = "base ATA for user")]
    #[account(9, writable, name = "user_quote", desc = "quote ATA for user")]
    #[account(10, writable, name = "user_lp", desc = "quote ATA for user")]
    #[account(11, writable, name = "amm_base", desc = "AMM base account")]
    #[account(12, writable, name = "amm_quote", desc = "AMM quote account")]
    #[account(13, writable, name = "trade_to_earn", desc = "AMM T2E account")]
    #[account(14, writable, name = "price_data", desc = "Price Data for AMM")]
    #[account(15, name = "quote_token_program", desc = "token program for quote")]
    #[account(16, name = "base_token_program", desc = "token progrma for base token")]
    #[account(17, name = "associated_token", desc = "associated token program")]
    #[account(18, name = "system_program", desc = "system program")]
    InitCookAMMExternal { args: InitCookAMMExternalArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, signer, name = "user_data", desc = "Users account, signer")]
    #[account(2, writable, name = "listing", desc = "Listing data account")]
    #[account(3, writable, name = "cook_data", desc = "Data account for lets cook")]
    #[account(4, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(5, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(6, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(7, writable, name = "amm", desc = "AMM data account")]
    #[account(8, writable, name = "amm_quote", desc = "AMM quote account")]
    #[account(9, writable, name = "amm_base", desc = "AMM base account")]
    #[account(10, writable, name = "lp_token_mint", desc = "AMM LP token mint")]
    #[account(11, writable, name = "price_data", desc = "Price Data for AMM")]
    #[account(12, name = "quote_token_program", desc = "token program for quote")]
    #[account(13, name = "base_token_program", desc = "token progrma for base token")]
    #[account(14, name = "associated_token", desc = "associated token program")]
    #[account(15, name = "system_program", desc = "system program")]
    CreateInstantLaunch { args: InstantLaunchArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "user_data", desc = "Users data account")]
    #[account(2, writable, name = "user_base", desc = "user base token ATA")]
    #[account(3, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(4, writable, name = "amm", desc = "AMM data account")]
    #[account(5, writable, name = "base_token_mint", desc = "base token mint")]
    #[account(6, writable, name = "quote_token_mint", desc = "quote token mint")]
    #[account(7, writable, name = "trade_to_earn", desc = "AMM T2E account")]
    #[account(8, name = "base_token_program", desc = "token progrma for base token")]
    #[account(9, name = "associated_token", desc = "associated token program")]
    #[account(10, name = "system_program", desc = "system program")]
    AddTradeRewards { args: AddTradeRewardsArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "collection_data", desc = "Collection data")]
    #[account(2, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(3, writable, name = "asset", desc = "asset account")]
    #[account(4, writable, name = "collection", desc = "collection account")]
    #[account(5, writable, name = "listing", desc = "listing account")]
    #[account(6, writable, name = "listing_summary", desc = "listing summary account")]
    #[account(7, name = "system_program", desc = "system program")]
    #[account(8, name = "core_program", desc = "core program")]
    #[account(9, name = "listing_program", desc = "listing program")]
    ListNFT { args: ListNFTArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "collection_data", desc = "Collection data")]
    #[account(2, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(3, writable, name = "asset", desc = "asset account")]
    #[account(4, writable, name = "collection", desc = "collection account")]
    #[account(5, writable, name = "listing", desc = "listing account")]
    #[account(6, writable, name = "listing_summary", desc = "listing summary account")]
    #[account(7, name = "system_program", desc = "system program")]
    #[account(8, name = "core_program", desc = "core program")]
    #[account(9, name = "listing_program", desc = "listing program")]
    UnlistNFT { args: UnlistNFTArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "collection_data", desc = "Collection data")]
    #[account(2, writable, name = "cook_pda", desc = "lets cook PDA")]
    #[account(3, writable, name = "asset", desc = "asset account")]
    #[account(4, writable, name = "collection", desc = "collection account")]
    #[account(5, writable, name = "seller", desc = "seller account")]
    #[account(6, writable, name = "listing", desc = "listing account")]
    #[account(7, writable, name = "listing_summary", desc = "listing summary account")]
    #[account(8, name = "system_program", desc = "system program")]
    #[account(9, name = "core_program", desc = "core program")]
    #[account(10, name = "listing_program", desc = "listing program")]
    BuyNFT { args: BuyNFTArgs },
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum TransferHookInstruction {
    /// Runs additional transfer logic.
    ///
    /// Accounts expected by this instruction:
    ///
    ///   0. `[]` Source account
    ///   1. `[]` Token mint
    ///   2. `[]` Destination account
    ///   3. `[]` Source account's owner/delegate
    ///   4. `[]` Validation account
    ///   5..5+M `[]` `M` additional accounts, written in validation account data
    ///
    Execute {
        /// Amount of tokens to transfer
        amount: u64,
    },
    InitializeExtraAccountMetas,
}

/// TLV instruction type only used to define the discriminator. The actual data
/// is entirely managed by `ExtraAccountMetaList`, and it is the only data contained
/// by this type.
#[derive(SplDiscriminate)]
#[discriminator_hash_input("spl-transfer-hook-interface:execute")]
pub struct ExecuteInstruction;

/// TLV instruction type used to initialize extra account metas
/// for the transfer hook
#[derive(SplDiscriminate)]
#[discriminator_hash_input("spl-transfer-hook-interface:initialize-extra-account-metas")]
pub struct InitializeExtraAccountMetaListInstruction;

impl TransferHookInstruction {
    /// Packs a [TokenInstruction](enum.TokenInstruction.html) into a byte buffer.
    pub fn pack(&self) -> Vec<u8> {
        let mut buf = vec![];
        match self {
            Self::Execute { amount } => {
                buf.extend_from_slice(ExecuteInstruction::SPL_DISCRIMINATOR_SLICE);
                buf.extend_from_slice(&amount.to_le_bytes());
            }
            Self::InitializeExtraAccountMetas => {
                buf.extend_from_slice(InitializeExtraAccountMetaListInstruction::SPL_DISCRIMINATOR_SLICE);
            }
        };
        buf
    }
}
