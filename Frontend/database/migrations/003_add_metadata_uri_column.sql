-- Migration to add metadata_uri column to launch_metadata table
-- This allows storing IPFS metadata URI for faster metadata fetching (primary source)

-- Add metadata_uri column if it doesn't exist
ALTER TABLE launch_metadata 
ADD COLUMN IF NOT EXISTS metadata_uri TEXT;

-- Add comment for documentation
COMMENT ON COLUMN launch_metadata.metadata_uri IS 'IPFS metadata URI - primary source for name, symbol, image (faster than blockchain parsing)';

