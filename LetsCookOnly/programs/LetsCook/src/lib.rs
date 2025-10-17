use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod lets_cook {
    use super::*;

    // Initialize the program
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let user_data = &mut ctx.accounts.user_data;
        user_data.authority = ctx.accounts.authority.key();
        user_data.bump = ctx.bumps.user_data;
        Ok(())
    }

    // Create a launch
    pub fn create_launch(ctx: Context<CreateLaunch>, args: CreateLaunchArgs) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        launch.authority = ctx.accounts.authority.key();
        launch.token_mint = args.token_mint;
        launch.price_per_token = args.price_per_token;
        launch.max_tokens = args.max_tokens;
        launch.start_time = args.start_time;
        launch.end_time = args.end_time;
        launch.bump = ctx.bumps.launch;
        Ok(())
    }

    // Join a launch (buy tokens)
    pub fn join_launch(ctx: Context<JoinLaunch>, amount: u64) -> Result<()> {
        // Transfer SOL from user to launch
        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.launch_vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.system_program.to_account_info();
        anchor_lang::system_program::transfer(
            CpiContext::new(cpi_program, cpi_accounts),
            amount,
        )?;

        // Update launch state
        let launch = &mut ctx.accounts.launch;
        launch.tokens_sold += amount / launch.price_per_token;
        
        Ok(())
    }

    // Claim tokens after launch ends
    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let launch = &ctx.accounts.launch;
        let clock = Clock::get()?;
        
        require!(clock.unix_timestamp >= launch.end_time, ErrorCode::LaunchNotEnded);
        
        // Calculate tokens to claim based on user's contribution
        let user_contribution = ctx.accounts.user_token_account.amount;
        let tokens_to_claim = (user_contribution * launch.max_tokens) / launch.tokens_sold;
        
        // Transfer tokens from launch to user
        let seeds = &[
            b"launch",
            launch.authority.as_ref(),
            &[launch.bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.launch_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.launch.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer),
            tokens_to_claim,
        )?;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + UserData::INIT_SPACE,
        seeds = [b"user_data", authority.key().as_ref()],
        bump
    )]
    pub user_data: Account<'info, UserData>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateLaunch<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Launch::INIT_SPACE,
        seeds = [b"launch", authority.key().as_ref()],
        bump
    )]
    pub launch: Account<'info, Launch>,
    
    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = launch,
    )]
    pub launch_vault: Account<'info, anchor_spl::token::TokenAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_mint: Account<'info, anchor_spl::token::Mint>,
    
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinLaunch<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,
    
    #[account(mut)]
    pub launch_vault: Account<'info, anchor_spl::token::TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,
    
    #[account(mut)]
    pub launch_token_account: Account<'info, anchor_spl::token::TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, anchor_spl::token::TokenAccount>,
    
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, anchor_spl::token::Token>,
}

#[account]
#[derive(InitSpace)]
pub struct UserData {
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Launch {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub price_per_token: u64,
    pub max_tokens: u64,
    pub tokens_sold: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateLaunchArgs {
    pub token_mint: Pubkey,
    pub price_per_token: u64,
    pub max_tokens: u64,
    pub start_time: i64,
    pub end_time: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Launch has not ended yet")]
    LaunchNotEnded,
}