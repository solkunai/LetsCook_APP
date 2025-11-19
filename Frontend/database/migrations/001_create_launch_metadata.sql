-- Create launch_metadata table for storing off-chain launch metadata
-- This reduces on-chain transaction size by storing description and socials off-chain

CREATE TABLE IF NOT EXISTS launch_metadata (
  launch_id TEXT PRIMARY KEY, -- Launch data PDA address
  token_mint TEXT NOT NULL, -- Token mint address
  metadata_uri TEXT, -- IPFS metadata URI (fallback source)
  name TEXT, -- Token name (primary source - faster than IPFS)
  symbol TEXT, -- Token symbol (primary source - faster than IPFS)
  image TEXT, -- Token image URL (primary source - faster than IPFS)
  description TEXT, -- Launch description (optional)
  website TEXT, -- Website URL (optional)
  twitter TEXT, -- Twitter handle or URL (optional)
  telegram TEXT, -- Telegram handle or URL (optional)
  discord TEXT, -- Discord server invite or handle (optional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add metadata_uri column if it doesn't exist (for tables created before this column was added)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'metadata_uri'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN metadata_uri TEXT;
  END IF;
  
  -- Add name, symbol, image columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'name'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN name TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'symbol'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN symbol TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'image'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN image TEXT;
  END IF;
END $$;

-- Create index on token_mint for faster lookups
CREATE INDEX IF NOT EXISTS idx_launch_metadata_token_mint ON launch_metadata(token_mint);

-- Create index on launch_id (already primary key, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_launch_metadata_launch_id ON launch_metadata(launch_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row updates
-- Drop trigger if it exists to make migration idempotent
DROP TRIGGER IF EXISTS update_launch_metadata_updated_at ON launch_metadata;
CREATE TRIGGER update_launch_metadata_updated_at
  BEFORE UPDATE ON launch_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE launch_metadata IS 'Stores off-chain metadata for launches (description, socials) to reduce on-chain transaction size';
COMMENT ON COLUMN launch_metadata.launch_id IS 'Primary key: Launch data PDA address from blockchain';
COMMENT ON COLUMN launch_metadata.token_mint IS 'Token mint address for the launched token';
COMMENT ON COLUMN launch_metadata.description IS 'Launch description stored off-chain';
COMMENT ON COLUMN launch_metadata.website IS 'Website URL for the launch';
COMMENT ON COLUMN launch_metadata.twitter IS 'Twitter handle or URL';
COMMENT ON COLUMN launch_metadata.telegram IS 'Telegram handle or invite URL';
COMMENT ON COLUMN launch_metadata.discord IS 'Discord server invite or handle';

-- Add comments for columns if they exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'metadata_uri'
  ) THEN
    COMMENT ON COLUMN launch_metadata.metadata_uri IS 'IPFS metadata URI - fallback source for name, symbol, image';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'name'
  ) THEN
    COMMENT ON COLUMN launch_metadata.name IS 'Token name - primary source (faster than IPFS/blockchain)';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'symbol'
  ) THEN
    COMMENT ON COLUMN launch_metadata.symbol IS 'Token symbol - primary source (faster than IPFS/blockchain)';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'image'
  ) THEN
    COMMENT ON COLUMN launch_metadata.image IS 'Token image URL - primary source (faster than IPFS/blockchain)';
  END IF;
END $$;

