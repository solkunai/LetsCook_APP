use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;
use spl_discriminator::SplDiscriminate;
use thiserror::Error;

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
                buf.extend_from_slice(
                    InitializeExtraAccountMetaListInstruction::SPL_DISCRIMINATOR_SLICE,
                );
            }
        };
        buf
    }
}
/// Get the state address PDA
pub fn get_extra_account_metas_address(mint: &Pubkey, program_id: &Pubkey) -> Pubkey {
    get_extra_account_metas_address_and_bump_seed(mint, program_id).0
}

/// Function used by programs implementing the interface, when creating the PDA,
/// to also get the bump seed
pub fn get_extra_account_metas_address_and_bump_seed(
    mint: &Pubkey,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(&collect_extra_account_metas_seeds(mint), program_id)
}

pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";

/// Function used by programs implementing the interface, when creating the PDA,
/// to get all of the PDA seeds
pub fn collect_extra_account_metas_seeds(mint: &Pubkey) -> [&[u8]; 2] {
    [EXTRA_ACCOUNT_METAS_SEED, mint.as_ref()]
}

/// Function used by programs implementing the interface, when creating the PDA,
/// to sign for the PDA
pub fn collect_extra_account_metas_signer_seeds<'a>(
    mint: &'a Pubkey,
    bump_seed: &'a [u8],
) -> [&'a [u8]; 3] {
    [EXTRA_ACCOUNT_METAS_SEED, mint.as_ref(), bump_seed]
}
