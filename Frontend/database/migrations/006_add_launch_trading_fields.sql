-- Migration to add trading-related fields to launch_metadata table
-- These fields are used for real-time trading operations and bonding curve calculations

-- Add total_supply column (BIGINT to handle large token supplies)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'total_supply'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN total_supply BIGINT;
    COMMENT ON COLUMN launch_metadata.total_supply IS 'Total token supply for the launch - used for bonding curve calculations and price calculations';
  END IF;
END $$;

-- Add creator_wallet_address column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'creator_wallet_address'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN creator_wallet_address TEXT;
    COMMENT ON COLUMN launch_metadata.creator_wallet_address IS 'Wallet address of the token creator - used for creator limits and ownership verification';
  END IF;
END $$;

-- Add decimals column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'decimals'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN decimals INTEGER;
    COMMENT ON COLUMN launch_metadata.decimals IS 'Token decimals (0-9) - used for proper token amount calculations';
  END IF;
END $$;

-- Add tokens_sold column (BIGINT to handle large amounts, updated in real-time)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'tokens_sold'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN tokens_sold BIGINT DEFAULT 0;
    COMMENT ON COLUMN launch_metadata.tokens_sold IS 'Real-time count of tokens sold - updated after each buy/sell transaction. Used for bonding curve price calculations.';
  END IF;
END $$;

-- Create index on creator_wallet_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_launch_metadata_creator_wallet ON launch_metadata(creator_wallet_address);

-- Create index on total_supply for filtering/sorting
CREATE INDEX IF NOT EXISTS idx_launch_metadata_total_supply ON launch_metadata(total_supply);

-- Create index on tokens_sold for real-time updates and sorting
CREATE INDEX IF NOT EXISTS idx_launch_metadata_tokens_sold ON launch_metadata(tokens_sold);

-- Add page_name column (for routing: /launch/:page_name)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'page_name'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN page_name TEXT;
    COMMENT ON COLUMN launch_metadata.page_name IS 'Page name for routing (e.g., /launch/:page_name) - derived from token name during launch creation';
  END IF;
END $$;

-- Add current_price column (NUMERIC for precise decimal prices)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'current_price'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN current_price NUMERIC(30, 18);
    COMMENT ON COLUMN launch_metadata.current_price IS 'Current token price in SOL - updated in real-time for instant frontend display. Uses NUMERIC(30,18) for precise decimal handling.';
  END IF;
END $$;

-- Add pool_sol_balance column (NUMERIC or BIGINT for SOL balance in AMM pool)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'pool_sol_balance'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN pool_sol_balance NUMERIC(30, 9);
    COMMENT ON COLUMN launch_metadata.pool_sol_balance IS 'SOL balance in the AMM pool (amm_quote WSOL balance or amm_account lamports) - updated in real-time for instant frontend display.';
  END IF;
END $$;

-- Create index on page_name for faster routing lookups
CREATE INDEX IF NOT EXISTS idx_launch_metadata_page_name ON launch_metadata(page_name);

-- Create index on current_price for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_launch_metadata_current_price ON launch_metadata(current_price);

-- Create index on pool_sol_balance for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_launch_metadata_pool_sol_balance ON launch_metadata(pool_sol_balance);

