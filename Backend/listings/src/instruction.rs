use borsh::{BorshDeserialize, BorshSerialize};
use shank::{ShankContext, ShankInstruction};

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct ListNFTArgs {
    pub price: u64,
}

#[derive(
    ShankContext, ShankInstruction, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq,
)]
pub enum ListingInstruction {
    #[account(0, writable, signer, name = "cook", desc = "Users account, signer")]
    #[account(1, writable, signer, name = "seller", desc = "Users account, signer")]
    #[account(2, writable, name = "asset", desc = "asset account")]
    #[account(3, writable, name = "collection", desc = "collection account")]
    #[account(4, writable, name = "listing", desc = "listing account")]
    #[account(5, writable, name = "summary", desc = "summary account")]
    #[account(6, name = "system_program", desc = "system program")]
    CreateListing { args: ListNFTArgs },
    #[account(0, writable, signer, name = "cook", desc = "Users account, signer")]
    #[account(1, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(2, writable, signer, name = "seller", desc = "Users account, signer")]
    #[account(3, writable, name = "asset", desc = "asset account")]
    #[account(4, writable, name = "collection", desc = "collection account")]
    #[account(5, writable, name = "listing", desc = "listing account")]
    #[account(6, writable, name = "summary", desc = "summary account")]
    #[account(7, name = "system_program", desc = "system program")]
    RemoveListing,
}
