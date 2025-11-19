-- Create bonding_curve_progress table for tracking buys/sells on bonding curve
-- This allows fast fetching without parsing blockchain each time

CREATE TABLE IF NOT EXISTS bonding_curve_progress (
  id BIGSERIAL PRIMARY KEY,
  token_mint TEXT NOT NULL, -- Token mint address
  launch_id TEXT NOT NULL, -- Launch data PDA address (for faster lookups)
  sol_collected NUMERIC(20, 9) DEFAULT 0, -- Total SOL collected in bonding curve (goal: 30 SOL)
  tokens_sold NUMERIC(20, 9) DEFAULT 0, -- Total tokens sold (calculated from pool reserves)
  sol_reserves NUMERIC(20, 9) DEFAULT 0, -- Current SOL reserves in AMM pool
  token_reserves NUMERIC(20, 9) DEFAULT 0, -- Current token reserves in AMM pool
  current_price NUMERIC(20, 9) DEFAULT 0, -- Current token price (from bonding curve or pool)
  initial_price NUMERIC(20, 9) DEFAULT 0.000001, -- Initial bonding curve price
  total_supply NUMERIC(20, 0) NOT NULL, -- Total token supply
  last_buy_transaction TEXT, -- Last buy transaction signature
  last_sell_transaction TEXT, -- Last sell transaction signature
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_mint) -- One row per token
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_bonding_curve_progress_token_mint ON bonding_curve_progress(token_mint);
CREATE INDEX IF NOT EXISTS idx_bonding_curve_progress_launch_id ON bonding_curve_progress(launch_id);
CREATE INDEX IF NOT EXISTS idx_bonding_curve_progress_sol_collected ON bonding_curve_progress(sol_collected DESC);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bonding_curve_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update last_updated on row updates
DROP TRIGGER IF EXISTS update_bonding_curve_progress_updated_at ON bonding_curve_progress;
CREATE TRIGGER update_bonding_curve_progress_updated_at
  BEFORE UPDATE ON bonding_curve_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_bonding_curve_updated_at();

-- Add comments for documentation
COMMENT ON TABLE bonding_curve_progress IS 'Tracks bonding curve progress (SOL collected, tokens sold, pool reserves) for fast fetching without blockchain parsing';
COMMENT ON COLUMN bonding_curve_progress.sol_collected IS 'Total SOL collected in bonding curve - goal is 30 SOL for graduation to Raydium';
COMMENT ON COLUMN bonding_curve_progress.tokens_sold IS 'Total tokens sold = total_supply - token_reserves in pool';
COMMENT ON COLUMN bonding_curve_progress.current_price IS 'Current token price from bonding curve calculation or AMM pool';



