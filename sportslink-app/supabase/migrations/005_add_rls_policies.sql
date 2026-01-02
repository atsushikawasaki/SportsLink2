-- Add Row Level Security (RLS) policies
-- Version: 1.0.0

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Allow authenticated users to insert their own record (for signup)
CREATE POLICY "Users can insert their own record"
    ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Allow users to read their own record
CREATE POLICY "Users can read their own record"
    ON users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Allow users to update their own record
CREATE POLICY "Users can update their own record"
    ON users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow service role to read all users (for admin operations)
-- Note: This requires service role key, which should only be used server-side
-- For now, we'll allow authenticated users with master flags to read all users
-- This will be handled in the API layer

-- Enable RLS on other tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE points ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

-- Tournaments policies
-- Allow authenticated users to create tournaments
CREATE POLICY "Users can create tournaments"
    ON tournaments
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by_user_id);

-- Allow users to read public tournaments or their own tournaments
CREATE POLICY "Users can read public or own tournaments"
    ON tournaments
    FOR SELECT
    TO authenticated
    USING (
        is_public = true
        OR created_by_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.tournament_id = tournaments.id
            AND user_roles.role = 'tournament_admin'
        )
    );

-- Allow tournament creators and admins to update tournaments
CREATE POLICY "Tournament creators and admins can update"
    ON tournaments
    FOR UPDATE
    TO authenticated
    USING (
        created_by_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.tournament_id = tournaments.id
            AND user_roles.role = 'tournament_admin'
        )
    );

-- User roles policies
-- Allow users to read their own roles
CREATE POLICY "Users can read their own roles"
    ON user_roles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Allow tournament admins to manage roles for their tournaments
CREATE POLICY "Tournament admins can manage roles"
    ON user_roles
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tournament_id = user_roles.tournament_id
            AND ur.role = 'tournament_admin'
        )
    );

-- Teams policies
-- Allow tournament admins and team managers to manage teams
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
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.tournament_id = teams.tournament_id
                    AND ur.role = 'tournament_admin'
                )
            )
        )
        OR team_manager_user_id = auth.uid()
    );

-- Allow reading teams for public tournaments
CREATE POLICY "Users can read teams for public tournaments"
    ON teams
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = teams.tournament_id
            AND t.is_public = true
        )
    );

-- Tournament players, pairs, entries policies
-- Allow tournament admins to manage these
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
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.tournament_id = tournament_players.tournament_id
                    AND ur.role = 'tournament_admin'
                )
            )
        )
    );

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
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.tournament_id = tournament_pairs.tournament_id
                    AND ur.role = 'tournament_admin'
                )
            )
        )
    );

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
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.tournament_id = tournament_entries.tournament_id
                    AND ur.role = 'tournament_admin'
                )
            )
        )
    );

-- Matches policies
-- Allow tournament admins, scorers, and assigned umpires to manage matches
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
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.tournament_id = matches.tournament_id
                    AND ur.role IN ('tournament_admin', 'scorer')
                )
                OR matches.umpire_id = auth.uid()
            )
        )
    );

-- Allow reading matches for public tournaments
CREATE POLICY "Users can read matches for public tournaments"
    ON matches
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = matches.tournament_id
            AND t.is_public = true
        )
    );

-- Match pairs, slots, scores policies
-- Allow same permissions as matches
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
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.tournament_id = m.tournament_id
                    AND ur.role IN ('tournament_admin', 'scorer')
                )
                OR m.umpire_id = auth.uid()
            )
        )
    );

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
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.tournament_id = m.tournament_id
                    AND ur.role IN ('tournament_admin', 'scorer')
                )
                OR m.umpire_id = auth.uid()
            )
        )
    );

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
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.tournament_id = m.tournament_id
                    AND ur.role IN ('tournament_admin', 'scorer')
                )
                OR m.umpire_id = auth.uid()
            )
        )
    );

-- Points policies
-- Allow scorers and umpires to insert points
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
                    SELECT 1 FROM user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.tournament_id = m.tournament_id
                    AND ur.role IN ('tournament_admin', 'scorer')
                )
                OR m.umpire_id = auth.uid()
            )
        )
    );

-- User consents policies
-- Allow users to insert and read their own consents
CREATE POLICY "Users can manage their own consents"
    ON user_consents
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Contact requests policies
-- Allow users to insert their own contact requests
CREATE POLICY "Users can create their own contact requests"
    ON contact_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Allow users to read their own contact requests
CREATE POLICY "Users can read their own contact requests"
    ON contact_requests
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

-- Audit logs policies (read-only for most users)
CREATE POLICY "Users can read audit logs for their own actions"
    ON audit_logs
    FOR SELECT
    TO authenticated
    USING (performed_by = auth.uid());

