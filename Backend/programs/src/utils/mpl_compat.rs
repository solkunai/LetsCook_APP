// Compatibility layer for MPL Core AccountInfo types
// MPL Core expects a different AccountInfo type, but they have the same memory layout
// We use unsafe transmute to convert between them at call sites

use solana_program::program_error::ProgramError;

/// Converts MPL Core error type to ProgramError  
pub fn convert_mpl_error(_e: impl std::fmt::Debug) -> ProgramError {
    ProgramError::Custom(1) // Generic error conversion
}
