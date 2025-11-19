-- Migration to add amm_base_token_account column to launch_metadata table
-- This column stores the amm_base token account address for trading operations

-- Add amm_base_token_account column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'amm_base_token_account'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN amm_base_token_account TEXT;
    COMMENT ON COLUMN launch_metadata.amm_base_token_account IS 'AMM base token account address - required for trading/buy/swap operations. This is the token account owned by the AMM that holds the base tokens for the liquidity pool.';
  END IF;
END $$;

-- Create index on amm_base_token_account for faster lookups during trading
CREATE INDEX IF NOT EXISTS idx_launch_metadata_amm_base_token_account ON launch_metadata(amm_base_token_account);

