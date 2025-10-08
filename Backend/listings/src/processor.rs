use borsh::BorshDeserialize;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, pubkey::Pubkey};

use crate::{create_listing, instruction::ListingInstruction, remove_listing};

pub struct Processor;

impl Processor {
    pub fn process<'a>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'a>],
        instruction_data: &[u8],
    ) -> ProgramResult {
        msg!("Get Instruction!");

        let instruction = ListingInstruction::try_from_slice(&instruction_data[..])?;
        match instruction {
            ListingInstruction::CreateListing { args } => {
                create_listing::create_listing(program_id, accounts, args)
            }
            ListingInstruction::RemoveListing => {
                remove_listing::remove_listing(program_id, accounts)
            }
        }
    }
}
