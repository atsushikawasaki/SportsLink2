-- Fix infinite recursion in match_pairs RLS policies
-- Version: 1.0.0
-- This migration fixes the infinite recursion issue by using a SECURITY DEFINER function
-- to check match permissions without triggering RLS on matches table

-- Step 1: Create a SECURITY DEFINER function to check match access
-- This function bypasses RLS on matches table to avoid recursion
CREATE OR REPLACE FUNCTION check_match_access(p_match_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tournament_id UUID;
    v_umpire_id UUID;
    v_created_by_user_id UUID;
    has_permission BOOLEAN := FALSE;
BEGIN
    -- Get match information (bypassing RLS)
    SELECT m.tournament_id, m.umpire_id, t.created_by_user_id
    INTO v_tournament_id, v_umpire_id, v_created_by_user_id
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE m.id = p_match_id;
    
    -- If match not found, return false
    IF v_tournament_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user is tournament creator
    IF v_created_by_user_id = p_user_id THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is assigned umpire
    IF v_umpire_id = p_user_id THEN
        RETURN TRUE;
    END IF;
    
    -- Check user_permissions (simple check, no recursion)
    -- Only check user's own permissions to avoid recursion
    SELECT EXISTS (
        SELECT 1 FROM user_permissions up
        WHERE up.user_id = p_user_id
        AND (
            -- Tournament admin or umpire for this tournament
            (up.tournament_id = v_tournament_id
             AND up.role_type IN ('tournament_admin', 'umpire'))
            -- Umpire for this specific match
            OR (up.match_id = p_match_id
                AND up.role_type = 'umpire')
            -- System admin
            OR (up.role_type = 'admin'
                AND up.tournament_id IS NULL
                AND up.team_id IS NULL
                AND up.match_id IS NULL)
        )
    ) INTO has_permission;
    
    RETURN has_permission;
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

