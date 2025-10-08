use thiserror::Error;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{pubkey::Pubkey};


#[derive(Error, Debug)]
pub enum Error {
    #[error("failed to read solana config file: ({0})")]
    ConfigReadError(std::io::Error),
   
    #[error("invalid config: ({0})")]
    InvalidConfig(String),

    #[error("serialization error: ({0})")]
    SerializationError(std::io::Error),

    #[error("solana client error: ({0})")]
    ClientError(#[from] solana_client::client_error::ClientError),

    #[error("error in public key derivation: ({0})")]
    KeyDerivationError(#[from] solana_sdk::pubkey::PubkeyError),
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum Move {
    #[default]
    None,
    Rock,
    Paper,
    Scissors
}

#[derive(Default, BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum Status {
    #[default]
    Waiting,
    InProgress,
    Completed
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct CreateArgs {
    pub bid_size : u64,
    pub seed : u32
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct MoveArgs {
    pub player_move : Move
}


#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum ArenaInstruction {
    Init,
    CreateGame {args : CreateArgs},
    JoinGame,
    CancelGame,
    TakeMove {args : MoveArgs}
}