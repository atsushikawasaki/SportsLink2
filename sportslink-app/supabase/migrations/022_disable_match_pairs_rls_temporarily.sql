-- Temporarily disable RLS on match_pairs to avoid recursion
-- Version: 1.0.0
-- This migration disables RLS on match_pairs table temporarily
-- Access control should be handled in the application layer using Admin Client

-- Step 1: Drop all existing match_pairs policies
DROP POLICY IF EXISTS "Authorized users can manage match pairs" ON match_pairs;

-- Step 2: Disable RLS on match_pairs table
-- Note: This allows all authenticated users to access match_pairs
-- Access control should be enforced in the application layer
ALTER TABLE match_pairs DISABLE ROW LEVEL SECURITY;

-- Step 3: Add comment for documentation
COMMENT ON TABLE match_pairs IS 
'RLS is disabled on this table to avoid infinite recursion. Access control is enforced in the application layer using Admin Client.';

-- Step 4: Also disable RLS on related tables to avoid similar issues
DO $$
BEGIN
    -- Disable RLS on match_slots if it exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'match_slots'
    ) THEN
        DROP POLICY IF EXISTS "Authorized users can manage match slots" ON match_slots;
        ALTER TABLE match_slots DISABLE ROW LEVEL SECURITY;
    END IF;

    -- Disable RLS on match_scores if it exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'match_scores'
    ) THEN
        DROP POLICY IF EXISTS "Authorized users can manage match scores" ON match_scores;
        ALTER TABLE match_scores DISABLE ROW LEVEL SECURITY;
    END IF;

    -- Disable RLS on points if it exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'points'
    ) THEN
        DROP POLICY IF EXISTS "Authorized users can manage points" ON points;
        ALTER TABLE points DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

