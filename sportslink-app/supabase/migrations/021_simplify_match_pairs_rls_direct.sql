-- Simplify match_pairs RLS policy to avoid recursion completely
-- Version: 1.0.0
-- This migration removes the check_match_access function call and uses direct checks
-- to avoid any possibility of recursion

-- Step 1: Drop existing match_pairs policy
DROP POLICY IF EXISTS "Authorized users can manage match pairs" ON match_pairs;

-- Step 2: Create new match_pairs policy with direct checks (no function calls)
-- This policy directly checks:
-- 1. Tournament creator
-- 2. Assigned umpire
-- No function calls means no possibility of recursion
CREATE POLICY "Authorized users can manage match pairs"
    ON match_pairs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM matches m
            JOIN tournaments t ON t.id = m.tournament_id
            WHERE m.id = match_pairs.match_id
            AND (
                t.created_by_user_id = auth.uid()
                OR m.umpire_id = auth.uid()
            )
        )
    );

-- Step 3: Update match_slots policy (if table exists)
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
            USING (
                EXISTS (
                    SELECT 1 FROM matches m
                    JOIN tournaments t ON t.id = m.tournament_id
                    WHERE m.id = match_slots.match_id
                    AND (
                        t.created_by_user_id = auth.uid()
                        OR m.umpire_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

-- Step 4: Update match_scores policy (if table exists)
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
            USING (
                EXISTS (
                    SELECT 1 FROM matches m
                    JOIN tournaments t ON t.id = m.tournament_id
                    WHERE m.id = match_scores.match_id
                    AND (
                        t.created_by_user_id = auth.uid()
                        OR m.umpire_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

-- Step 5: Update points policy (if table exists)
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
            USING (
                EXISTS (
                    SELECT 1 FROM matches m
                    JOIN tournaments t ON t.id = m.tournament_id
                    WHERE m.id = points.match_id
                    AND (
                        t.created_by_user_id = auth.uid()
                        OR m.umpire_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

-- Step 6: Add comment for documentation
COMMENT ON POLICY "Authorized users can manage match pairs" ON match_pairs IS 
'Simplified RLS policy for match_pairs table. Uses direct checks without function calls to avoid recursion. Only checks tournament creator and assigned umpire.';

