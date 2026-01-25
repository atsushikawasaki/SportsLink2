-- Fix check_match_access function to properly bypass RLS
-- Version: 1.0.0
-- This migration changes the function owner to postgres to bypass RLS
-- postgres user has BYPASSRLS privilege which allows RLS to be bypassed

-- Step 1: Recreate the function (if it doesn't exist or needs update)
CREATE OR REPLACE FUNCTION check_match_access(p_match_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tournament_id UUID;
    v_umpire_id UUID;
    v_created_by_user_id UUID;
BEGIN
    -- Get match information
    -- With SECURITY DEFINER and postgres ownership, this will bypass RLS
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
    
    -- Get tournament creator
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

-- Step 2: Change function owner to postgres to bypass RLS
-- This is the key fix: postgres user has BYPASSRLS privilege
-- Note: This may fail in Supabase if postgres user is not available
-- In that case, the function will still work but RLS may still apply
DO $$
BEGIN
    -- Try to change owner to postgres
    -- If this fails, the function will still work but may not bypass RLS
    BEGIN
        ALTER FUNCTION check_match_access(UUID, UUID) OWNER TO postgres;
    EXCEPTION
        WHEN insufficient_privilege THEN
            -- If we can't change owner, log a warning but continue
            RAISE WARNING 'Could not change function owner to postgres. RLS bypass may not work.';
        WHEN OTHERS THEN
            -- For any other error, also log a warning
            RAISE WARNING 'Error changing function owner: %', SQLERRM;
    END;
END $$;

-- Step 3: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_match_access(UUID, UUID) TO authenticated;

-- Step 4: Add comment for documentation
COMMENT ON FUNCTION check_match_access(UUID, UUID) IS 
'Check if a user has access to a match. Uses SECURITY DEFINER with postgres ownership (if available) to bypass RLS on matches and tournaments tables and avoid infinite recursion.';

