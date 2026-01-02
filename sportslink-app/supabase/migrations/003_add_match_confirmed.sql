-- Add is_confirmed column to matches table
-- This column indicates whether a match result has been confirmed by tournament admin

ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT FALSE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_is_confirmed ON matches(is_confirmed) WHERE is_confirmed = TRUE;

