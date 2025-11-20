# Database Migrations

This directory contains SQL migration scripts for Supabase database setup.

## Setup Instructions

### 1. Access Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**

### 2. Run the Migration

Copy and paste the contents of `migrations/001_create_launch_metadata.sql` into the SQL editor and click **Run**.

Alternatively, you can run it via the Supabase CLI:

```bash
supabase db push
```

### 3. Verify Table Creation

After running the migration, verify the table was created:

```sql
SELECT * FROM launch_metadata LIMIT 1;
```

You should see the table structure with all columns.

## Table Schema

### `launch_metadata`

| Column | Type | Description |
|--------|------|-------------|
| `launch_id` | TEXT (PK) | Launch data PDA address from blockchain |
| `token_mint` | TEXT | Token mint address |
| `description` | TEXT | Launch description (optional) |
| `website` | TEXT | Website URL (optional) |
| `twitter` | TEXT | Twitter handle or URL (optional) |
| `telegram` | TEXT | Telegram handle or URL (optional) |
| `discord` | TEXT | Discord server invite or handle (optional) |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated on row update |

## Indexes

- Primary key index on `launch_id`
- Index on `token_mint` for faster lookups by token mint address

## Automatic Features

- `created_at` is automatically set to current timestamp on insert
- `updated_at` is automatically updated to current timestamp on row update via trigger

## Row Level Security (RLS)

If you want to add Row Level Security policies, you can add them after creating the table:

```sql
-- Enable RLS
ALTER TABLE launch_metadata ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (for public launch data)
CREATE POLICY "Allow public read access" ON launch_metadata
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert/update (for launch creators)
CREATE POLICY "Allow authenticated insert/update" ON launch_metadata
  FOR ALL
  USING (auth.role() = 'authenticated');
```




