use borsh::BorshDeserialize;

use crate::amm;

use crate::instruction::LaunchInstruction;
use crate::launch;
use crate::listings;
use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, pubkey::Pubkey};

use crate::common;
use crate::hybrid;

pub struct Processor;
impl Processor {
    pub fn process<'a>(program_id: &Pubkey, accounts: &'a [AccountInfo<'a>], instruction_data: &[u8]) -> ProgramResult {
        msg!("get instruction");
        let instruction = LaunchInstruction::try_from_slice(&instruction_data[..])?;

        //msg!("process instruction {:?}", instruction);
        match instruction {
            LaunchInstruction::Init => common::init(program_id, accounts),

            LaunchInstruction::CreateLaunch { args } => launch::create_launch(program_id, accounts, args),

            LaunchInstruction::BuyTickets { args } => launch::join_launch(program_id, accounts, args),

            LaunchInstruction::CheckTickets => launch::check_tickets(program_id, accounts),

            LaunchInstruction::InitCookAMM => amm::init_amm(program_id, accounts),

            LaunchInstruction::HypeVote { args } => common::hype_vote(program_id, accounts, args),

            LaunchInstruction::ClaimRefund => launch::claim_refund(program_id, accounts),

            LaunchInstruction::EditLaunch { args } => launch::edit_launch(program_id, accounts, args),

            LaunchInstruction::ClaimTokens => launch::claim_tokens(program_id, accounts),

            LaunchInstruction::SetName { args } => common::set_name(program_id, accounts, args),
            LaunchInstruction::SwapCookAMM { args } => amm::perform_swap(program_id, accounts, args),
            LaunchInstruction::GetMMRewardTokens { args } => amm::get_mm_rewards(program_id, accounts, args),
            LaunchInstruction::CloseAccount => common::close_account(program_id, accounts),
            LaunchInstruction::LaunchCollection { args } => hybrid::launch_collection(program_id, accounts, args),
            LaunchInstruction::ClaimNFT { args } => hybrid::claim_nft(program_id, accounts, args),
            LaunchInstruction::MintNFT => hybrid::mint_nft(program_id, accounts),
            LaunchInstruction::WrapNFT => hybrid::wrap_nft(program_id, accounts),
            LaunchInstruction::EditCollection { args } => hybrid::edit_collection(program_id, accounts, args),
            LaunchInstruction::MintRandomNFT => hybrid::mint_random(program_id, accounts),
            LaunchInstruction::CreateOpenBookMarket => Ok(()),
            LaunchInstruction::CreateRaydium { args } => amm::raydium_init(program_id, accounts, args),
            LaunchInstruction::SwapRaydium { args } => amm::raydium_swap(program_id, accounts, args),
            LaunchInstruction::AddCookLiquidity { args } => amm::add_liquidity(program_id, accounts, args),
            LaunchInstruction::RemoveCookLiquidity { args } => amm::remove_liquidity(program_id, accounts, args),
            LaunchInstruction::CreateUnverifiedListing { args } => listings::edit_listing(program_id, accounts, args),
            LaunchInstruction::CreateListing { args } => listings::create_listing(program_id, accounts, args),
            LaunchInstruction::SwapRaydiumClassic { args } => amm::raydium_classic_swap(program_id, accounts, args),
            LaunchInstruction::InitCookAMMExternal { args } => amm::init_amm_external(program_id, accounts, args),
            LaunchInstruction::CreateInstantLaunch { args } => launch::instant_launch(program_id, accounts, args),
            LaunchInstruction::AddTradeRewards { args } => amm::add_rewards(program_id, accounts, args),
            LaunchInstruction::ListNFT { args } => hybrid::list_asset(program_id, accounts, args),
            LaunchInstruction::UnlistNFT { args } => hybrid::unlist_asset(program_id, accounts, args),
            LaunchInstruction::BuyNFT { args } => hybrid::buy_asset(program_id, accounts, args),
        }
    }
}
