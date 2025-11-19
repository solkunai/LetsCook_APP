-- Optional: Add Row Level Security (RLS) policies for launch_metadata table
-- Uncomment and run if you want to restrict access

-- Enable RLS on launch_metadata table
ALTER TABLE launch_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (launch metadata is public)
CREATE POLICY "Allow public read access" ON launch_metadata
  FOR SELECT
  USING (true);

-- Policy: Allow anyone to insert (launch creators may not be authenticated via Supabase)
-- Since we're using Solana wallet signatures for authentication, we allow anonymous inserts
CREATE POLICY "Allow anonymous insert" ON launch_metadata
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow authenticated users to update (launch creators can update their own metadata)
-- Note: You may want to add a check to ensure users can only update their own launches
-- This would require storing creator wallet address in the table or checking against launch data
CREATE POLICY "Allow authenticated update" ON launch_metadata
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to delete (optional - for cleanup)
-- Uncomment if you want to allow deletion
-- CREATE POLICY "Allow authenticated delete" ON launch_metadata
--   FOR DELETE
--   USING (auth.role() = 'authenticated');

