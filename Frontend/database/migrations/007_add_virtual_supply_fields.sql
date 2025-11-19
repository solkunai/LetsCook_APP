-- Migration to add virtual supply fields to launch_metadata table
-- This supports the "virtual supply" + "real supply" system that allows
-- users to enter any supply amount while preventing u64 overflow

-- Add virtual_supply column (BIGINT - what the user entered)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'virtual_supply'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN virtual_supply BIGINT;
    COMMENT ON COLUMN launch_metadata.virtual_supply IS 'Virtual supply (what the user entered) - displayed in UI, can be any value';
  END IF;
END $$;

-- Add real_supply column (BIGINT - what was actually minted, safe for u64)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'real_supply'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN real_supply BIGINT;
    COMMENT ON COLUMN launch_metadata.real_supply IS 'Real supply (what was actually minted) - used for bonding curve calculations, guaranteed to fit in u64';
  END IF;
END $$;

-- Add scale_factor column (NUMERIC - the scaling factor applied if virtual > real)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'launch_metadata' AND column_name = 'scale_factor'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN scale_factor NUMERIC(30, 6);
    COMMENT ON COLUMN launch_metadata.scale_factor IS 'Scale factor applied during conversion (1.0 if no scaling, >1.0 if scaled down)';
  END IF;
END $$;

-- Update existing records: set real_supply = total_supply and virtual_supply = total_supply
-- (for existing launches, assume they were not scaled)
UPDATE launch_metadata 
SET 
  real_supply = COALESCE(total_supply, 0),
  virtual_supply = COALESCE(total_supply, 0),
  scale_factor = 1.0
WHERE real_supply IS NULL OR virtual_supply IS NULL;

-- Create index on real_supply for bonding curve calculations
CREATE INDEX IF NOT EXISTS idx_launch_metadata_real_supply ON launch_metadata(real_supply);

-- Create index on virtual_supply for display/sorting
CREATE INDEX IF NOT EXISTS idx_launch_metadata_virtual_supply ON launch_metadata(virtual_supply);


