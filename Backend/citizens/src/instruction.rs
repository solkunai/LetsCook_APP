use borsh::{BorshDeserialize, BorshSerialize};
use shank::{ShankContext, ShankInstruction};

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct StartMissionArgs {
    pub difficulty: u8,
    pub seed: [u8; 32],
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct WrapIdx {
    pub idx: u8,
}

#[derive(
    ShankContext, ShankInstruction, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq,
)]
pub enum CitizenInstruction {
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "asset", desc = "asset account")]
    #[account(2, writable, name = "collection", desc = "collection account")]
    #[account(3, writable, name = "user_data", desc = "user data account")]
    #[account(4, writable, name = "pda", desc = "pda account")]
    #[account(5, writable, name = "summary", desc = "summary account")]
    #[account(6, writable, name = "randoms", desc = "randoms account")]
    #[account(7, name = "system_program", desc = "system program")]
    #[account(8, name = "core_program", desc = "core program")]
    StartMission { args: StartMissionArgs },
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "asset", desc = "asset account")]
    #[account(2, writable, name = "collection", desc = "collection account")]
    #[account(3, writable, name = "user_data", desc = "user data account")]
    #[account(4, writable, name = "pda", desc = "pda account")]
    #[account(5, writable, name = "randoms", desc = "randoms account")]
    #[account(6, name = "system_program", desc = "system program")]
    #[account(7, name = "core_program", desc = "core program")]
    #[account(8, name = "lets_cook", desc = "lets cook program")]
    #[account(9, writable, name = "cook_user_data", desc = "lets cook user data")]
    #[account(10, writable, name = "cook_collection_data", desc = "collection data")]
    #[account(11, writable, name = "cook_pda", desc = "lets cook pda")]
    #[account(12, writable, name = "token_mint", desc = "token mint")]
    #[account(13, writable, name = "user_token", desc = "user token ATA")]
    #[account(14, writable, name = "cook_token", desc = "lets cook token ATA")]
    #[account(15, writable, name = "team_token", desc = "team token ATA")]
    #[account(16, name = "token_program", desc = "token program")]
    #[account(17, name = "associated_token", desc = "associated token program")]
    ResolveMission,
    #[account(0, writable, signer, name = "user", desc = "Users account, signer")]
    #[account(1, writable, name = "asset", desc = "asset account")]
    #[account(2, writable, name = "collection", desc = "collection account")]
    #[account(3, writable, name = "betrayer_data", desc = "betrayer data account")]
    #[account(4, writable, name = "betrayer_token", desc = "betrayer token account")]
    #[account(5, writable, name = "pda", desc = "pda account")]
    #[account(6, name = "system_program", desc = "system program")]
    #[account(7, name = "core_program", desc = "core program")]
    #[account(8, name = "lets_cook", desc = "lets cook program")]
    #[account(9, writable, name = "cook_user_data", desc = "lets cook user data")]
    #[account(10, writable, name = "cook_collection_data", desc = "collection data")]
    #[account(11, writable, name = "cook_pda", desc = "lets cook pda")]
    #[account(12, writable, name = "token_mint", desc = "token mint")]
    #[account(13, writable, name = "user_token", desc = "user token ATA")]
    #[account(14, writable, name = "cook_token", desc = "lets cook token ATA")]
    #[account(15, writable, name = "team_token", desc = "team token ATA")]
    #[account(16, writable, name = "fees_token", desc = "fee token ATA")]
    #[account(17, name = "token_program", desc = "token program")]
    #[account(18, name = "associated_token", desc = "associated token program")]
    Betray,
}
