-- Migration to add supply conversion fields required by LaunchMetadataService
-- These columns track the user's requested (virtual) supply, the actual minted
-- (real) supply, and the scale factor applied during conversion.

-- Add virtual_supply column (stores the user input before scaling)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_metadata' AND column_name = 'virtual_supply'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN virtual_supply BIGINT;
    COMMENT ON COLUMN launch_metadata.virtual_supply IS 'Virtual supply entered by the user before scaling (display only).';
  END IF;
END $$;

-- Add real_supply column (stores the actual minted amount, used for trading)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_metadata' AND column_name = 'real_supply'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN real_supply BIGINT;
    COMMENT ON COLUMN launch_metadata.real_supply IS 'Real token supply minted on-chain after virtual-to-real conversion.';
  END IF;
END $$;

-- Add scale_factor column (store conversion multiplier to display adjustments)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'launch_metadata' AND column_name = 'scale_factor'
  ) THEN
    ALTER TABLE launch_metadata ADD COLUMN scale_factor NUMERIC(30, 18);
    COMMENT ON COLUMN launch_metadata.scale_factor IS 'Scale factor applied when converting virtual supply to real supply.';
  END IF;
END $$;

-- Helpful indexes for querying by supply values
CREATE INDEX IF NOT EXISTS idx_launch_metadata_virtual_supply ON launch_metadata(virtual_supply);
CREATE INDEX IF NOT EXISTS idx_launch_metadata_real_supply ON launch_metadata(real_supply);

