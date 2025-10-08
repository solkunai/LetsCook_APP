use borsh::BorshDeserialize;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, pubkey::Pubkey};

use crate::{betray, instruction::CitizenInstruction, resolve_mission, start_mission};

pub struct Processor;

impl Processor {
    pub fn process<'a>(
        program_id: &Pubkey,
        accounts: &'a [AccountInfo<'a>],
        instruction_data: &[u8],
    ) -> ProgramResult {
        msg!("Get Instruction!");

        let instruction = CitizenInstruction::try_from_slice(&instruction_data[..])?;
        match instruction {
            CitizenInstruction::StartMission { args } => {
                start_mission::start_mission(program_id, accounts, args)
            }
            CitizenInstruction::ResolveMission => {
                resolve_mission::resolve_mission(program_id, accounts)
            }
            CitizenInstruction::Betray => betray::betray(program_id, accounts),
        }
    }
}
