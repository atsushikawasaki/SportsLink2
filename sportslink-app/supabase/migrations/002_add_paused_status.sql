-- Add 'paused' status to matches table
-- This migration adds 'paused' as a valid status for matches

-- First, drop the existing check constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;

-- Add the new check constraint with 'paused' status
ALTER TABLE matches ADD CONSTRAINT matches_status_check 
    CHECK (status IN ('pending', 'inprogress', 'paused', 'finished'));

