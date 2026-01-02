-- Update RLS policies for Unified RBAC
-- Version: 1.0.0
-- This migration updates existing RLS policies to use user_permissions instead of userroles

-- Step 1: Drop old userroles policies (they will be replaced)
-- Check for both userroles and user_roles table names for compatibility
DO $$
BEGIN
    -- Drop policies from userroles table (without underscore)
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'userroles'
    ) THEN
        DROP POLICY IF EXISTS "Users can read their own roles" ON userroles;
        DROP POLICY IF EXISTS "Tournament admins can manage roles" ON userroles;
    -- Drop policies from user_roles table (with underscore) as fallback
    ELSIF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_roles'
    ) THEN
        DROP POLICY IF EXISTS "Users can read their own roles" ON user_roles;
        DROP POLICY IF EXISTS "Tournament admins can manage roles" ON user_roles;
    END IF;
END $$;

-- Step 2: Update tournaments policies to use user_permissions
DROP POLICY IF EXISTS "Users can read public or own tournaments" ON tournaments;
CREATE POLICY "Users can read public or own tournaments"
    ON tournaments
    FOR SELECT
    TO authenticated
    USING (
        is_public = true
        OR created_by_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.tournament_id = tournaments.id
            AND up.role_type = 'tournament_admin'
        )
        OR EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.role_type = 'admin'
            AND up.tournament_id IS NULL
            AND up.team_id IS NULL
            AND up.match_id IS NULL
        )
    );

DROP POLICY IF EXISTS "Tournament creators and admins can update" ON tournaments;
CREATE POLICY "Tournament creators and admins can update"
    ON tournaments
    FOR UPDATE
    TO authenticated
    USING (
        created_by_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.tournament_id = tournaments.id
            AND up.role_type = 'tournament_admin'
        )
        OR EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.role_type = 'admin'
            AND up.tournament_id IS NULL
            AND up.team_id IS NULL
            AND up.match_id IS NULL
        )
    );

-- Step 3: Update teams policies to use user_permissions
DROP POLICY IF EXISTS "Tournament admins and team managers can manage teams" ON teams;
CREATE POLICY "Tournament admins and team managers can manage teams"
    ON teams
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = teams.tournament_id
            AND (
                t.created_by_user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.tournament_id = teams.tournament_id
                    AND up.role_type = 'tournament_admin'
                )
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.role_type = 'admin'
                    AND up.tournament_id IS NULL
                    AND up.team_id IS NULL
                    AND up.match_id IS NULL
                )
            )
        )
        OR team_manager_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.team_id = teams.id
            AND up.role_type = 'team_admin'
        )
        OR EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.role_type = 'admin'
            AND up.tournament_id IS NULL
            AND up.team_id IS NULL
            AND up.match_id IS NULL
        )
    );

-- Step 4: Update tournament_players policies
DROP POLICY IF EXISTS "Tournament admins can manage tournament players" ON tournament_players;
CREATE POLICY "Tournament admins can manage tournament players"
    ON tournament_players
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_players.tournament_id
            AND (
                t.created_by_user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.tournament_id = tournament_players.tournament_id
                    AND up.role_type = 'tournament_admin'
                )
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.role_type = 'admin'
                    AND up.tournament_id IS NULL
                    AND up.team_id IS NULL
                    AND up.match_id IS NULL
                )
            )
        )
    );

-- Step 5: Update tournament_pairs policies
DROP POLICY IF EXISTS "Tournament admins can manage tournament pairs" ON tournament_pairs;
CREATE POLICY "Tournament admins can manage tournament pairs"
    ON tournament_pairs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_pairs.tournament_id
            AND (
                t.created_by_user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.tournament_id = tournament_pairs.tournament_id
                    AND up.role_type = 'tournament_admin'
                )
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.role_type = 'admin'
                    AND up.tournament_id IS NULL
                    AND up.team_id IS NULL
                    AND up.match_id IS NULL
                )
            )
        )
    );

-- Step 6: Update tournament_entries policies
DROP POLICY IF EXISTS "Tournament admins can manage tournament entries" ON tournament_entries;
CREATE POLICY "Tournament admins can manage tournament entries"
    ON tournament_entries
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_entries.tournament_id
            AND (
                t.created_by_user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.tournament_id = tournament_entries.tournament_id
                    AND up.role_type = 'tournament_admin'
                )
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.role_type = 'admin'
                    AND up.tournament_id IS NULL
                    AND up.team_id IS NULL
                    AND up.match_id IS NULL
                )
            )
        )
    );

-- Step 7: Update matches policies
DROP POLICY IF EXISTS "Authorized users can manage matches" ON matches;
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
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.tournament_id = matches.tournament_id
                    AND up.role_type IN ('tournament_admin', 'umpire')
                )
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.match_id = matches.id
                    AND up.role_type = 'umpire'
                )
                OR matches.umpire_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.role_type = 'admin'
                    AND up.tournament_id IS NULL
                    AND up.team_id IS NULL
                    AND up.match_id IS NULL
                )
            )
        )
    );

-- Step 8: Update match_pairs policies
DROP POLICY IF EXISTS "Authorized users can manage match pairs" ON match_pairs;
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
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.tournament_id = m.tournament_id
                    AND up.role_type IN ('tournament_admin', 'umpire')
                )
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.match_id = m.id
                    AND up.role_type = 'umpire'
                )
                OR m.umpire_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.role_type = 'admin'
                    AND up.tournament_id IS NULL
                    AND up.team_id IS NULL
                    AND up.match_id IS NULL
                )
            )
        )
    );

-- Step 9: Update match_slots policies (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'match_slots'
    ) THEN
        DROP POLICY IF EXISTS "Authorized users can manage match slots" ON match_slots;
        EXECUTE '
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
                        OR EXISTS (
                            SELECT 1 FROM user_permissions up
                            WHERE up.user_id = auth.uid()
                            AND up.tournament_id = m.tournament_id
                            AND up.role_type IN (''tournament_admin'', ''umpire'')
                        )
                        OR EXISTS (
                            SELECT 1 FROM user_permissions up
                            WHERE up.user_id = auth.uid()
                            AND up.match_id = m.id
                            AND up.role_type = ''umpire''
                        )
                        OR m.umpire_id = auth.uid()
                        OR EXISTS (
                            SELECT 1 FROM user_permissions up
                            WHERE up.user_id = auth.uid()
                            AND up.role_type = ''admin''
                            AND up.tournament_id IS NULL
                            AND up.team_id IS NULL
                            AND up.match_id IS NULL
                        )
                    )
                )
            )';
    END IF;
END $$;

-- Step 10: Update match_scores policies (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'match_scores'
    ) THEN
        DROP POLICY IF EXISTS "Authorized users can manage match scores" ON match_scores;
        EXECUTE '
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
                        OR EXISTS (
                            SELECT 1 FROM user_permissions up
                            WHERE up.user_id = auth.uid()
                            AND up.tournament_id = m.tournament_id
                            AND up.role_type IN (''tournament_admin'', ''umpire'')
                        )
                        OR EXISTS (
                            SELECT 1 FROM user_permissions up
                            WHERE up.user_id = auth.uid()
                            AND up.match_id = m.id
                            AND up.role_type = ''umpire''
                        )
                        OR m.umpire_id = auth.uid()
                        OR EXISTS (
                            SELECT 1 FROM user_permissions up
                            WHERE up.user_id = auth.uid()
                            AND up.role_type = ''admin''
                            AND up.tournament_id IS NULL
                            AND up.team_id IS NULL
                            AND up.match_id IS NULL
                        )
                    )
                )
            )';
    END IF;
END $$;

-- Step 11: Update points policies (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'points'
    ) THEN
        DROP POLICY IF EXISTS "Authorized users can manage points" ON points;
        EXECUTE '
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
                        OR EXISTS (
                            SELECT 1 FROM user_permissions up
                            WHERE up.user_id = auth.uid()
                            AND up.tournament_id = m.tournament_id
                            AND up.role_type IN (''tournament_admin'', ''umpire'')
                        )
                        OR EXISTS (
                            SELECT 1 FROM user_permissions up
                            WHERE up.user_id = auth.uid()
                            AND up.match_id = m.id
                            AND up.role_type = ''umpire''
                        )
                        OR m.umpire_id = auth.uid()
                        OR EXISTS (
                            SELECT 1 FROM user_permissions up
                            WHERE up.user_id = auth.uid()
                            AND up.role_type = ''admin''
                            AND up.tournament_id IS NULL
                            AND up.team_id IS NULL
                            AND up.match_id IS NULL
                        )
                    )
                )
            )';
    END IF;
END $$;

