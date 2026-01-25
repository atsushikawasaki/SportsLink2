-- Simplify matches table RLS policy to avoid recursion
-- Version: 1.0.0
-- This migration simplifies the matches RLS policy to avoid referencing user_permissions
-- which can cause infinite recursion when check_match_access function queries matches table

-- Step 1: Drop existing matches policy
DROP POLICY IF EXISTS "Authorized users can manage matches" ON matches;

-- Step 2: Create simplified matches policy that doesn't reference user_permissions
-- This policy only checks:
-- 1. Tournament creator
-- 2. Assigned umpire
-- Additional permission checks (tournament_admin, etc.) should be handled
-- in the application layer using Admin Client which bypasses RLS
CREATE POLICY "Authorized users can manage matches"
    ON matches
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = matches.tournament_id
            AND (
                t.created_by_user_id = auth.uid()
                OR matches.umpire_id = auth.uid()
            )
        )
    );

-- Step 3: Keep the public tournaments read policy (it doesn't cause recursion)
-- This policy is already simple and doesn't reference user_permissions

-- Step 4: Add comment for documentation
COMMENT ON POLICY "Authorized users can manage matches" ON matches IS 
'Simplified RLS policy for matches table. Only checks tournament creator and assigned umpire. Additional permission checks (tournament_admin, etc.) are handled in the application layer using Admin Client.';

