-- Supabase Database Schema for Cache and Events
-- Run this SQL in your Supabase SQL editor

-- Cache Data Table
CREATE TABLE IF NOT EXISTS cache_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key TEXT NOT NULL,
    cache_type TEXT NOT NULL CHECK (cache_type IN ('price_data', 'event', 'launch_data', 'market_data', 'bonding_curve', 'liquidity_lock')),
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT cache_data_unique_key_type UNIQUE(cache_key, cache_type)
);

-- Create unique index for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_data_key_type ON cache_data(cache_key, cache_type);

-- Create index on cache_key and cache_type for fast lookups
CREATE INDEX IF NOT EXISTS idx_cache_key_type ON cache_data(cache_key, cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_data(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_type ON cache_data(cache_type);

-- On-chain Events Table
CREATE TABLE IF NOT EXISTS on_chain_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    token_mint TEXT,
    launch_id TEXT,
    event_data JSONB NOT NULL,
    transaction_signature TEXT,
    block_time BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_events_token_mint ON on_chain_events(token_mint);
CREATE INDEX IF NOT EXISTS idx_events_launch_id ON on_chain_events(launch_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON on_chain_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON on_chain_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_transaction_signature ON on_chain_events(transaction_signature);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_events_token_type ON on_chain_events(token_mint, event_type);
CREATE INDEX IF NOT EXISTS idx_events_launch_type ON on_chain_events(launch_id, event_type);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on cache_data
DROP TRIGGER IF EXISTS update_cache_data_updated_at ON cache_data;
CREATE TRIGGER update_cache_data_updated_at BEFORE UPDATE ON cache_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cache entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM cache_data WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Enable Row Level Security (RLS)
ALTER TABLE cache_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_chain_events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous reads (for public cache data)
DROP POLICY IF EXISTS "Allow anonymous read access" ON cache_data;
CREATE POLICY "Allow anonymous read access" ON cache_data
    FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS "Allow anonymous read access" ON on_chain_events;
CREATE POLICY "Allow anonymous read access" ON on_chain_events
    FOR SELECT
    TO anon
    USING (true);

-- Policy: Allow anonymous writes (for cache updates)
DROP POLICY IF EXISTS "Allow anonymous write access" ON cache_data;
CREATE POLICY "Allow anonymous write access" ON cache_data
    FOR INSERT
    TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update access" ON cache_data;
CREATE POLICY "Allow anonymous update access" ON cache_data
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous insert access" ON on_chain_events;
CREATE POLICY "Allow anonymous insert access" ON on_chain_events
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Policy: Allow anonymous deletes (for cache cleanup)
DROP POLICY IF EXISTS "Allow anonymous delete access" ON cache_data;
CREATE POLICY "Allow anonymous delete access" ON cache_data
    FOR DELETE
    TO anon
    USING (true);

DROP POLICY IF EXISTS "Allow anonymous delete access" ON on_chain_events;
CREATE POLICY "Allow anonymous delete access" ON on_chain_events
    FOR DELETE
    TO anon
    USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON cache_data TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON on_chain_events TO anon;
-- Note: No sequence grants needed since we're using UUID primary keys (gen_random_uuid())

-- Create a view for recent events
CREATE OR REPLACE VIEW recent_events AS
SELECT 
    id,
    event_type,
    token_mint,
    launch_id,
    event_data,
    transaction_signature,
    block_time,
    created_at
FROM on_chain_events
ORDER BY created_at DESC
LIMIT 1000;

-- Create a view for cache statistics
CREATE OR REPLACE VIEW cache_stats AS
SELECT 
    cache_type,
    COUNT(*) as entry_count,
    COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
    COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
    MIN(created_at) as oldest_entry,
    MAX(created_at) as newest_entry
FROM cache_data
GROUP BY cache_type;

