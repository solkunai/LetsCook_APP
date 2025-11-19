use solana_program::account_info::AccountInfo;
use solana_program::program_error::ProgramError;

// Generic context wrapper
pub struct Context<'a, T> {
    pub accounts: T,
    pub remaining_accounts: &'a [AccountInfo<'a>],
}

// Account structures for different instructions
#[derive(Debug)]
pub struct CheckTicketsAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub join_data: &'a AccountInfo<'a>,
    pub user_data: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub orao_random: &'a AccountInfo<'a>,
}

impl<'a> CheckTicketsAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                launch_data: &accounts[1],
                join_data: &accounts[2],
                user_data: &accounts[3],
                system_program: &accounts[4],
                orao_random: &accounts[5],
            },
            remaining_accounts: &accounts[6..],
        })
    }
}

#[derive(Debug)]
pub struct ClaimTokensAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub join_data: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub user_token_account: &'a AccountInfo<'a>,
    pub token_mint: &'a AccountInfo<'a>,
    pub user_data: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub cook_base_token: &'a AccountInfo<'a>,
    pub base_token_mint: &'a AccountInfo<'a>,
    pub launch_quote: &'a AccountInfo<'a>,
    pub quote_token_mint: &'a AccountInfo<'a>,
    pub cook_base_token_vault: &'a AccountInfo<'a>,
    pub cook_quote_token_vault: &'a AccountInfo<'a>,
    pub temp_wsol: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub associated_token: &'a AccountInfo<'a>,
    pub base_token_program: &'a AccountInfo<'a>,
    pub quote_token_program: &'a AccountInfo<'a>,
    pub user_base: &'a AccountInfo<'a>,
}

impl<'a> ClaimTokensAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                launch_data: &accounts[1],
                join_data: &accounts[2],
                listing: &accounts[3],
                user_token_account: &accounts[4],
                token_mint: &accounts[5],
                user_data: &accounts[6],
                cook_pda: &accounts[7],
                cook_base_token: &accounts[8],
                base_token_mint: &accounts[9],
                launch_quote: &accounts[10],
                quote_token_mint: &accounts[11],
                cook_base_token_vault: &accounts[12],
                cook_quote_token_vault: &accounts[13],
                temp_wsol: &accounts[14],
                system_program: &accounts[15],
                associated_token: &accounts[16],
                base_token_program: &accounts[17],
                quote_token_program: &accounts[18],
                user_base: &accounts[19],
            },
            remaining_accounts: &accounts[20..],
        })
    }
}

#[derive(Debug)]
pub struct ClaimRefundAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub join_data: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub temp_wsol: &'a AccountInfo<'a>,
    pub launch_quote: &'a AccountInfo<'a>,
    pub quote_token_mint: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub quote_token_program: &'a AccountInfo<'a>,
}

impl<'a> ClaimRefundAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                launch_data: &accounts[1],
                join_data: &accounts[2],
                system_program: &accounts[3],
                temp_wsol: &accounts[4],
                launch_quote: &accounts[5],
                quote_token_mint: &accounts[6],
                cook_pda: &accounts[7],
                quote_token_program: &accounts[8],
            },
            remaining_accounts: &accounts[9..],
        })
    }
}

#[derive(Debug)]
pub struct CreateLaunchAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub team: &'a AccountInfo<'a>,
    pub base_token_mint: &'a AccountInfo<'a>,
    pub quote_token_mint: &'a AccountInfo<'a>,
    pub cook_data: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub launch_quote: &'a AccountInfo<'a>,
    pub cook_base_token: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub token_2022_program: &'a AccountInfo<'a>,
    pub base_token_program: &'a AccountInfo<'a>,
    pub quote_token_program: &'a AccountInfo<'a>,
    pub associated_token: &'a AccountInfo<'a>,
    pub whitelist: &'a AccountInfo<'a>,
    pub delegate: &'a AccountInfo<'a>,
    pub hook: &'a AccountInfo<'a>,
}

impl<'a> CreateLaunchAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                launch_data: &accounts[2],
                team: &accounts[3],
                base_token_mint: &accounts[4],
                quote_token_mint: &accounts[5],
                cook_data: &accounts[6],
                cook_pda: &accounts[7],
                launch_quote: &accounts[8],
                cook_base_token: &accounts[9],
                system_program: &accounts[10],
                token_program: &accounts[11],
                token_2022_program: &accounts[12],
                base_token_program: &accounts[13],
                quote_token_program: &accounts[14],
                associated_token: &accounts[15],
                whitelist: &accounts[16],
                delegate: &accounts[17],
                hook: &accounts[18],
            },
            remaining_accounts: &accounts[19..],
        })
    }
}

#[derive(Debug)]
pub struct EditLaunchAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub base_token_mint: &'a AccountInfo<'a>,
    pub quote_token_mint: &'a AccountInfo<'a>,
    pub amm: &'a AccountInfo<'a>,
    pub amm_pool: &'a AccountInfo<'a>,
    pub amm_base: &'a AccountInfo<'a>,
    pub amm_quote: &'a AccountInfo<'a>,
    pub lp_token_mint: &'a AccountInfo<'a>,
    pub trade_to_earn: &'a AccountInfo<'a>,
    pub user_data: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub base_token_program: &'a AccountInfo<'a>,
    pub quote_token_program: &'a AccountInfo<'a>,
    pub associated_token: &'a AccountInfo<'a>,
}

impl<'a> EditLaunchAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                launch_data: &accounts[1],
                listing: &accounts[2],
                base_token_mint: &accounts[3],
                quote_token_mint: &accounts[4],
                amm: &accounts[5],
                amm_pool: &accounts[6],
                amm_base: &accounts[7],
                amm_quote: &accounts[8],
                lp_token_mint: &accounts[9],
                trade_to_earn: &accounts[10],
                user_data: &accounts[11],
                system_program: &accounts[12],
                base_token_program: &accounts[13],
                quote_token_program: &accounts[14],
                associated_token: &accounts[15],
            },
            remaining_accounts: &accounts[16..],
        })
    }
}

#[derive(Debug)]
pub struct CreateInstantLaunchAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub base_token_mint: &'a AccountInfo<'a>,
    pub quote_token_mint: &'a AccountInfo<'a>,
    pub cook_data: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub amm: &'a AccountInfo<'a>,
    pub amm_quote: &'a AccountInfo<'a>,
    pub lp_token_mint: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub base_token_program: &'a AccountInfo<'a>,
    pub quote_token_program: &'a AccountInfo<'a>,
    pub price_data: &'a AccountInfo<'a>,
    pub associated_token: &'a AccountInfo<'a>,
    pub cook_base_token: &'a AccountInfo<'a>, // ATA for cook_pda to hold initial token supply
    pub amm_base: &'a AccountInfo<'a>,
    pub user_data: &'a AccountInfo<'a>,
}

impl<'a> CreateInstantLaunchAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        // Bounds check before accessing accounts array
        if accounts.len() < 18 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        
        // Create context - all accesses are bounds-checked above
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                launch_data: &accounts[2],
                base_token_mint: &accounts[3],
                quote_token_mint: &accounts[4],
                cook_data: &accounts[5],
                cook_pda: &accounts[6],
                amm: &accounts[7],
                amm_quote: &accounts[8],
                lp_token_mint: &accounts[9],
                system_program: &accounts[10],
                base_token_program: &accounts[11],
                quote_token_program: &accounts[12],
                price_data: &accounts[13],
                associated_token: &accounts[14],
                cook_base_token: &accounts[15], // ATA for cook_pda
                amm_base: &accounts[16],
                user_data: &accounts[17],
            },
            remaining_accounts: &accounts[18..],
        })
    }
}

#[derive(Debug)]
pub struct BuyTicketsAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub join_data: &'a AccountInfo<'a>,
    pub user_data: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub orao_random: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub launch_quote: &'a AccountInfo<'a>,
    pub orao_program: &'a AccountInfo<'a>,
    pub quote_token_program: &'a AccountInfo<'a>,
    pub pda: &'a AccountInfo<'a>,
    pub whitelist_mint: &'a AccountInfo<'a>,
    pub whitelist_token_program: &'a AccountInfo<'a>,
    pub whitelist_account: &'a AccountInfo<'a>,
    pub orao_network: &'a AccountInfo<'a>,
    pub orao_treasury: &'a AccountInfo<'a>,
    pub fees: &'a AccountInfo<'a>,
}

impl<'a> BuyTicketsAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                launch_data: &accounts[1],
                join_data: &accounts[2],
                user_data: &accounts[3],
                system_program: &accounts[4],
                orao_random: &accounts[5],
                listing: &accounts[6],
                launch_quote: &accounts[7],
                orao_program: &accounts[8],
                quote_token_program: &accounts[9],
                pda: &accounts[10],
                whitelist_mint: &accounts[11],
                whitelist_token_program: &accounts[12],
                whitelist_account: &accounts[13],
                orao_network: &accounts[14],
                orao_treasury: &accounts[15],
                fees: &accounts[16],
            },
            remaining_accounts: &accounts[17..],
        })
    }
}

// Missing account structs
#[derive(Debug)]
pub struct CreateListingAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub base_token_mint: &'a AccountInfo<'a>,
    pub quote_token_mint: &'a AccountInfo<'a>,
    pub amm: &'a AccountInfo<'a>,
    pub amm_pool: &'a AccountInfo<'a>,
    pub amm_base: &'a AccountInfo<'a>,
    pub amm_quote: &'a AccountInfo<'a>,
    pub lp_token_mint: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub base_token_program: &'a AccountInfo<'a>,
    pub quote_token_program: &'a AccountInfo<'a>,
    pub associated_token: &'a AccountInfo<'a>,
    pub unverified: &'a AccountInfo<'a>,
    pub creator: &'a AccountInfo<'a>,
    pub cook_data: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub creator_data: &'a AccountInfo<'a>,
    pub quote_mint: &'a AccountInfo<'a>,
}

impl<'a> CreateListingAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                launch_data: &accounts[2],
                base_token_mint: &accounts[3],
                quote_token_mint: &accounts[4],
                amm: &accounts[5],
                amm_pool: &accounts[6],
                amm_base: &accounts[7],
                amm_quote: &accounts[8],
                lp_token_mint: &accounts[9],
                system_program: &accounts[10],
                base_token_program: &accounts[11],
                quote_token_program: &accounts[12],
                associated_token: &accounts[13],
                unverified: &accounts[14],
                creator: &accounts[15],
                cook_data: &accounts[16],
                cook_pda: &accounts[17],
                creator_data: &accounts[18],
                quote_mint: &accounts[19],
            },
            remaining_accounts: &accounts[20..],
        })
    }
}

#[derive(Debug)]
pub struct CreateAmmQuoteAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub amm: &'a AccountInfo<'a>,
    pub quote_token_mint: &'a AccountInfo<'a>,
    pub quote_token_program: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
}

impl<'a> CreateAmmQuoteAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        if accounts.len() < 5 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                amm: &accounts[1],
                quote_token_mint: &accounts[2],
                quote_token_program: &accounts[3],
                system_program: &accounts[4],
            },
            remaining_accounts: &accounts[5..],
        })
    }
}

#[derive(Debug)]
pub struct CreateUnverifiedListingAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub base_token_mint: &'a AccountInfo<'a>,
    pub cook_data: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub user_data: &'a AccountInfo<'a>,
}

impl<'a> CreateUnverifiedListingAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                system_program: &accounts[2],
                base_token_mint: &accounts[3],
                cook_data: &accounts[4],
                cook_pda: &accounts[5],
                user_data: &accounts[6],
            },
            remaining_accounts: &accounts[7..],
        })
    }
}

#[derive(Debug)]
pub struct BuyNFTAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub nft_mint: &'a AccountInfo<'a>,
    pub user_nft_account: &'a AccountInfo<'a>,
    pub seller_nft_account: &'a AccountInfo<'a>,
    pub seller: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub collection_data: &'a AccountInfo<'a>,
    pub core_program: &'a AccountInfo<'a>,
    pub asset: &'a AccountInfo<'a>,
    pub collection: &'a AccountInfo<'a>,
    pub listing_program: &'a AccountInfo<'a>,
    pub listing_summary: &'a AccountInfo<'a>,
}

impl<'a> BuyNFTAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                nft_mint: &accounts[2],
                user_nft_account: &accounts[3],
                seller_nft_account: &accounts[4],
                seller: &accounts[5],
                cook_pda: &accounts[6],
                system_program: &accounts[7],
                token_program: &accounts[8],
                collection_data: &accounts[9],
                core_program: &accounts[10],
                asset: &accounts[11],
                collection: &accounts[12],
                listing_program: &accounts[13],
                listing_summary: &accounts[14],
            },
            remaining_accounts: &accounts[15..],
        })
    }
}

#[derive(Debug)]
pub struct ClaimNFTAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub join_data: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub nft_mint: &'a AccountInfo<'a>,
    pub user_nft_account: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub orao_random: &'a AccountInfo<'a>,
    pub collection_data: &'a AccountInfo<'a>,
    pub collection: &'a AccountInfo<'a>,
    pub token_mint: &'a AccountInfo<'a>,
    pub assignment: &'a AccountInfo<'a>,
    pub orao_program: &'a AccountInfo<'a>,
    pub token_destination: &'a AccountInfo<'a>,
    pub user_token: &'a AccountInfo<'a>,
    pub orao_network: &'a AccountInfo<'a>,
    pub orao_treasury: &'a AccountInfo<'a>,
    pub user_data: &'a AccountInfo<'a>,
    pub cook_fees: &'a AccountInfo<'a>,
    pub whitelist_mint: &'a AccountInfo<'a>,
    pub whitelist_token_program: &'a AccountInfo<'a>,
    pub whitelist_account: &'a AccountInfo<'a>,
}

impl<'a> ClaimNFTAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                launch_data: &accounts[1],
                join_data: &accounts[2],
                listing: &accounts[3],
                nft_mint: &accounts[4],
                user_nft_account: &accounts[5],
                cook_pda: &accounts[6],
                system_program: &accounts[7],
                token_program: &accounts[8],
                orao_random: &accounts[9],
                collection_data: &accounts[10],
                collection: &accounts[11],
                token_mint: &accounts[12],
                assignment: &accounts[13],
                orao_program: &accounts[14],
                token_destination: &accounts[15],
                user_token: &accounts[16],
                orao_network: &accounts[17],
                orao_treasury: &accounts[18],
                user_data: &accounts[19],
                cook_fees: &accounts[20],
                whitelist_mint: &accounts[21],
                whitelist_token_program: &accounts[22],
                whitelist_account: &accounts[23],
            },
            remaining_accounts: &accounts[24..],
        })
    }
}

#[derive(Debug)]
pub struct EditCollectionAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub collection_data: &'a AccountInfo<'a>,
    pub cook_data: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub associated_token: &'a AccountInfo<'a>,
    pub team: &'a AccountInfo<'a>,
    pub token_mint: &'a AccountInfo<'a>,
    pub team_token: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub cook_token: &'a AccountInfo<'a>,
    pub user_data: &'a AccountInfo<'a>,
}

impl<'a> EditCollectionAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                launch_data: &accounts[2],
                system_program: &accounts[3],
                collection_data: &accounts[4],
                cook_data: &accounts[5],
                token_program: &accounts[6],
                associated_token: &accounts[7],
                team: &accounts[8],
                token_mint: &accounts[9],
                team_token: &accounts[10],
                cook_pda: &accounts[11],
                cook_token: &accounts[12],
                user_data: &accounts[13],
            },
            remaining_accounts: &accounts[14..],
        })
    }
}

#[derive(Debug)]
pub struct LaunchCollectionAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub collection_mint: &'a AccountInfo<'a>,
    pub nft_mint: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub collection_data: &'a AccountInfo<'a>,
    pub core_program: &'a AccountInfo<'a>,
    pub whitelist_mint: &'a AccountInfo<'a>,
    pub token_mint: &'a AccountInfo<'a>,
    pub collection: &'a AccountInfo<'a>,
    pub team: &'a AccountInfo<'a>,
}

impl<'a> LaunchCollectionAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                launch_data: &accounts[2],
                collection_mint: &accounts[3],
                nft_mint: &accounts[4],
                cook_pda: &accounts[5],
                system_program: &accounts[6],
                token_program: &accounts[7],
                collection_data: &accounts[8],
                core_program: &accounts[9],
                whitelist_mint: &accounts[10],
                token_mint: &accounts[11],
                collection: &accounts[12],
                team: &accounts[13],
            },
            remaining_accounts: &accounts[14..],
        })
    }
}

#[derive(Debug)]
pub struct ListNFTAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub nft_mint: &'a AccountInfo<'a>,
    pub user_nft_account: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub collection_data: &'a AccountInfo<'a>,
    pub core_program: &'a AccountInfo<'a>,
    pub asset: &'a AccountInfo<'a>,
    pub collection: &'a AccountInfo<'a>,
    pub listing_program: &'a AccountInfo<'a>,
    pub listing_summary: &'a AccountInfo<'a>,
}

impl<'a> ListNFTAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                nft_mint: &accounts[2],
                user_nft_account: &accounts[3],
                cook_pda: &accounts[4],
                system_program: &accounts[5],
                token_program: &accounts[6],
                collection_data: &accounts[7],
                core_program: &accounts[8],
                asset: &accounts[9],
                collection: &accounts[10],
                listing_program: &accounts[11],
                listing_summary: &accounts[12],
            },
            remaining_accounts: &accounts[13..],
        })
    }
}

#[derive(Debug)]
pub struct MintNFTAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub nft_mint: &'a AccountInfo<'a>,
    pub user_nft_account: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub collection_data: &'a AccountInfo<'a>,
    pub assignment: &'a AccountInfo<'a>,
    pub collection: &'a AccountInfo<'a>,
    pub orao_random: &'a AccountInfo<'a>,
    pub token_mint: &'a AccountInfo<'a>,
    pub user_token: &'a AccountInfo<'a>,
    pub cook_token: &'a AccountInfo<'a>,
    pub team: &'a AccountInfo<'a>,
    pub team_token: &'a AccountInfo<'a>,
    pub core_program: &'a AccountInfo<'a>,
    pub asset: &'a AccountInfo<'a>,
}

impl<'a> MintNFTAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                launch_data: &accounts[2],
                nft_mint: &accounts[3],
                user_nft_account: &accounts[4],
                cook_pda: &accounts[5],
                system_program: &accounts[6],
                token_program: &accounts[7],
                collection_data: &accounts[8],
                assignment: &accounts[9],
                collection: &accounts[10],
                orao_random: &accounts[11],
                token_mint: &accounts[12],
                user_token: &accounts[13],
                cook_token: &accounts[14],
                team: &accounts[15],
                team_token: &accounts[16],
                core_program: &accounts[17],
                asset: &accounts[18],
            },
            remaining_accounts: &accounts[19..],
        })
    }
}

#[derive(Debug)]
pub struct MintRandomNFTAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub launch_data: &'a AccountInfo<'a>,
    pub collection_mint: &'a AccountInfo<'a>,
    pub nft_mint: &'a AccountInfo<'a>,
    pub user_nft_account: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub assignment: &'a AccountInfo<'a>,
    pub collection: &'a AccountInfo<'a>,
    pub collection_data: &'a AccountInfo<'a>,
    pub token_mint: &'a AccountInfo<'a>,
    pub user_token: &'a AccountInfo<'a>,
    pub cook_token: &'a AccountInfo<'a>,
    pub team: &'a AccountInfo<'a>,
    pub team_token: &'a AccountInfo<'a>,
    pub orao_random: &'a AccountInfo<'a>,
    pub core_program: &'a AccountInfo<'a>,
    pub asset: &'a AccountInfo<'a>,
}

impl<'a> MintRandomNFTAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                launch_data: &accounts[2],
                collection_mint: &accounts[3],
                nft_mint: &accounts[4],
                user_nft_account: &accounts[5],
                cook_pda: &accounts[6],
                system_program: &accounts[7],
                token_program: &accounts[8],
                assignment: &accounts[9],
                collection: &accounts[10],
                collection_data: &accounts[11],
                token_mint: &accounts[12],
                user_token: &accounts[13],
                cook_token: &accounts[14],
                team: &accounts[15],
                team_token: &accounts[16],
                orao_random: &accounts[17],
                core_program: &accounts[18],
                asset: &accounts[19],
            },
            remaining_accounts: &accounts[20..],
        })
    }
}

#[derive(Debug)]
pub struct UnlistNFTAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub nft_mint: &'a AccountInfo<'a>,
    pub user_nft_account: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub collection_data: &'a AccountInfo<'a>,
    pub core_program: &'a AccountInfo<'a>,
    pub asset: &'a AccountInfo<'a>,
    pub collection: &'a AccountInfo<'a>,
    pub listing_program: &'a AccountInfo<'a>,
    pub listing_summary: &'a AccountInfo<'a>,
}

impl<'a> UnlistNFTAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                nft_mint: &accounts[2],
                user_nft_account: &accounts[3],
                cook_pda: &accounts[4],
                system_program: &accounts[5],
                token_program: &accounts[6],
                collection_data: &accounts[7],
                core_program: &accounts[8],
                asset: &accounts[9],
                collection: &accounts[10],
                listing_program: &accounts[11],
                listing_summary: &accounts[12],
            },
            remaining_accounts: &accounts[13..],
        })
    }
}

#[derive(Debug)]
pub struct WrapNFTAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub listing: &'a AccountInfo<'a>,
    pub nft_mint: &'a AccountInfo<'a>,
    pub user_nft_account: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub collection_data: &'a AccountInfo<'a>,
    pub token_mint: &'a AccountInfo<'a>,
    pub cook_token: &'a AccountInfo<'a>,
    pub core_program: &'a AccountInfo<'a>,
    pub associated_token: &'a AccountInfo<'a>,
    pub user_data: &'a AccountInfo<'a>,
    pub user_token: &'a AccountInfo<'a>,
    pub team_token: &'a AccountInfo<'a>,
    pub asset: &'a AccountInfo<'a>,
    pub collection: &'a AccountInfo<'a>,
}

impl<'a> WrapNFTAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                listing: &accounts[1],
                nft_mint: &accounts[2],
                user_nft_account: &accounts[3],
                cook_pda: &accounts[4],
                system_program: &accounts[5],
                token_program: &accounts[6],
                collection_data: &accounts[7],
                token_mint: &accounts[8],
                cook_token: &accounts[9],
                core_program: &accounts[10],
                associated_token: &accounts[11],
                user_data: &accounts[12],
                user_token: &accounts[13],
                team_token: &accounts[14],
                asset: &accounts[15],
                collection: &accounts[16],
            },
            remaining_accounts: &accounts[17..],
        })
    }
}

#[derive(Debug)]
pub struct InitAccounts<'a> {
    pub user: &'a AccountInfo<'a>,
    pub program_data: &'a AccountInfo<'a>,
    pub system_program: &'a AccountInfo<'a>,
    pub cook_data: &'a AccountInfo<'a>,
    pub cook_pda: &'a AccountInfo<'a>,
}

impl<'a> InitAccounts<'a> {
    pub fn context(accounts: &'a [AccountInfo<'a>]) -> Result<Context<'a, Self>, ProgramError> {
        Ok(Context {
            accounts: Self {
                user: &accounts[0],
                program_data: &accounts[1],
                system_program: &accounts[2],
                cook_data: &accounts[3],
                cook_pda: &accounts[4],
            },
            remaining_accounts: &accounts[5..],
        })
    }
}

