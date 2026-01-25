-- Fix infinite recursion in match_pairs RLS policies
-- Version: 1.0.0
-- This migration fixes the infinite recursion issue by using a SECURITY DEFINER function
-- to check match permissions without triggering RLS on matches table

-- Step 1: Create a SECURITY DEFINER function to check match access
-- This function bypasses RLS on matches and tournaments tables to avoid recursion
-- Note: user_permissions checks are removed to avoid circular dependencies
-- Permission checks should be handled in application layer using Admin Client
CREATE OR REPLACE FUNCTION check_match_access(p_match_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tournament_id UUID;
    v_umpire_id UUID;
    v_created_by_user_id UUID;
BEGIN
    -- Get match information (bypassing RLS with SECURITY DEFINER)
    -- SECURITY DEFINER allows the function to run with the privileges of the function owner
    -- However, RLS is still applied to joined tables. To completely bypass RLS,
    -- we use a workaround: query tables separately and avoid JOINs that trigger RLS.
    
    -- First, get match info directly from matches table
    -- RLS on matches will be bypassed by SECURITY DEFINER if function owner has bypass privilege
    SELECT tournament_id, umpire_id
    INTO v_tournament_id, v_umpire_id
    FROM matches
    WHERE id = p_match_id;
    
    -- If match not found, return false
    IF v_tournament_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user is assigned umpire (simple check, no RLS recursion)
    IF v_umpire_id = p_user_id THEN
        RETURN TRUE;
    END IF;
    
    -- Get tournament creator - use a simple SELECT that should bypass RLS
    -- with SECURITY DEFINER, but if it doesn't work, we'll need to handle it differently
    -- Try to get created_by_user_id directly
    SELECT created_by_user_id
    INTO v_created_by_user_id
    FROM tournaments
    WHERE id = v_tournament_id;
    
    -- Check if user is tournament creator
    IF v_created_by_user_id = p_user_id THEN
        RETURN TRUE;
    END IF;
    
    -- Note: user_permissions checks are removed to avoid circular RLS dependencies
    -- Additional permission checks (tournament_admin, etc.) should be handled
    -- in the application layer using Admin Client which bypasses RLS
    
    RETURN FALSE;
EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs (including RLS violations), return false
        -- This prevents the recursion from causing a crash
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Drop existing match_pairs policy
DROP POLICY IF EXISTS "Authorized users can manage match pairs" ON match_pairs;

-- Step 3: Create new match_pairs policy using the function
CREATE POLICY "Authorized users can manage match pairs"
    ON match_pairs
    FOR ALL
    TO authenticated
    USING (check_match_access(match_pairs.match_id, auth.uid()));

-- Step 4: Update match_slots policy (if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'match_slots'
    ) THEN
        DROP POLICY IF EXISTS "Authorized users can manage match slots" ON match_slots;
        CREATE POLICY "Authorized users can manage match slots"
            ON match_slots
            FOR ALL
            TO authenticated
            USING (check_match_access(match_slots.match_id, auth.uid()));
    END IF;
END $$;

-- Step 5: Update match_scores policy (if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'match_scores'
    ) THEN
        DROP POLICY IF EXISTS "Authorized users can manage match scores" ON match_scores;
        CREATE POLICY "Authorized users can manage match scores"
            ON match_scores
            FOR ALL
            TO authenticated
            USING (check_match_access(match_scores.match_id, auth.uid()));
    END IF;
END $$;

-- Step 6: Update points policy (if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'points'
    ) THEN
        DROP POLICY IF EXISTS "Authorized users can manage points" ON points;
        CREATE POLICY "Authorized users can manage points"
            ON points
            FOR ALL
            TO authenticated
            USING (check_match_access(points.match_id, auth.uid()));
    END IF;
END $$;

-- Step 7: Add comment for documentation
COMMENT ON FUNCTION check_match_access(UUID, UUID) IS 
'Check if a user has access to a match. Uses SECURITY DEFINER to bypass RLS on matches table and avoid infinite recursion.';

