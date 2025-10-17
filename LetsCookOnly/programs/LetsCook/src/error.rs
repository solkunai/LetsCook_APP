use anchor_lang::prelude::*;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum RNGError {
    /// Invalid instruction
    #[error("Invalid Instruction")]
    InvalidInstruction,
}

impl From<RNGError> for ProgramError {
    fn from(e: RNGError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
