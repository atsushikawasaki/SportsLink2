-- Entry-centric schema: teams as persistent master, entries as single source of participation
-- 1. teams: remove tournament_id (persistent master)
-- 2. tournament_entries: add region_name, custom_display_name; drop affiliation_key; entry_type 'team'|'doubles'|'singles'
-- 3. tournament_players: add entry_id, sort_order; rename team_id to actual_team_id; drop tournament_id
-- 4. tournament_pairs: add entry_id; drop tournament_id, team_id
-- 5. tournament_teams: drop if exists
-- 6. RLS: update policies to use entry_id / tournament_entries for tournament_players and tournament_pairs; teams via tournament_entries

-- ========== 1. teams: persistent master ==========
-- Drop policies that depend on teams.tournament_id BEFORE dropping the column
DROP POLICY IF EXISTS "Public tournament teams are viewable" ON teams;
DROP POLICY IF EXISTS "Users can read teams for public tournaments" ON teams;
DROP POLICY IF EXISTS "Tournament admins and team managers can manage teams" ON teams;

ALTER TABLE teams DROP COLUMN IF EXISTS tournament_id;
ALTER TABLE teams DROP COLUMN IF EXISTS school_name;
ALTER TABLE teams DROP COLUMN IF EXISTS description;

-- ========== 2. tournament_entries ==========
ALTER TABLE tournament_entries ADD COLUMN IF NOT EXISTS region_name TEXT;
ALTER TABLE tournament_entries ADD COLUMN IF NOT EXISTS custom_display_name TEXT;
ALTER TABLE tournament_entries DROP COLUMN IF EXISTS affiliation_key;

-- Migrate existing 'pair' to 'doubles' before changing constraint
UPDATE tournament_entries SET entry_type = 'doubles' WHERE entry_type = 'pair';

ALTER TABLE tournament_entries DROP CONSTRAINT IF EXISTS tournament_entries_entry_type_check;
ALTER TABLE tournament_entries ADD CONSTRAINT tournament_entries_entry_type_check
  CHECK (entry_type IN ('team', 'doubles', 'singles'));

-- Relax CHECK: team entry has team_id; doubles/singles may have pair_id (set after pair creation)
ALTER TABLE tournament_entries DROP CONSTRAINT IF EXISTS tournament_entries_check;
ALTER TABLE tournament_entries ADD CONSTRAINT tournament_entries_check
  CHECK (
    (entry_type = 'team' AND team_id IS NOT NULL AND pair_id IS NULL)
    OR (entry_type IN ('doubles', 'singles'))
  );

-- ========== 3. tournament_players ==========
-- Drop policies that depend on tournament_players.tournament_id BEFORE dropping the column
DROP POLICY IF EXISTS "Public tournament players are viewable" ON tournament_players;
DROP POLICY IF EXISTS "Tournament creators can manage tournament players" ON tournament_players;
DROP POLICY IF EXISTS "Tournament admins can manage tournament players" ON tournament_players;

ALTER TABLE tournament_players ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES tournament_entries(id) ON DELETE CASCADE;
ALTER TABLE tournament_players ADD COLUMN IF NOT EXISTS sort_order SMALLINT;
ALTER TABLE tournament_players RENAME COLUMN team_id TO actual_team_id;
ALTER TABLE tournament_players DROP COLUMN IF EXISTS tournament_id;

-- ========== 4. tournament_pairs ==========
-- Drop policies that depend on tournament_pairs.tournament_id (and team_id) BEFORE dropping columns
DROP POLICY IF EXISTS "Public tournament pairs are viewable" ON tournament_pairs;
DROP POLICY IF EXISTS "Tournament creators can manage tournament pairs" ON tournament_pairs;
DROP POLICY IF EXISTS "Tournament admins can manage tournament pairs" ON tournament_pairs;
DROP POLICY IF EXISTS "Team managers can manage their team pairs" ON tournament_pairs;

-- Drop unique constraint that uses tournament_id, team_id
ALTER TABLE tournament_pairs DROP CONSTRAINT IF EXISTS tournament_pairs_tournament_id_team_id_pair_number_key;
ALTER TABLE tournament_pairs ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES tournament_entries(id) ON DELETE CASCADE;
ALTER TABLE tournament_pairs DROP COLUMN IF EXISTS tournament_id;
ALTER TABLE tournament_pairs DROP COLUMN IF EXISTS team_id;

-- Optional: unique per entry (one pair per entry for doubles/singles)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_pairs_entry_id ON tournament_pairs(entry_id) WHERE entry_id IS NOT NULL;

-- ========== 5. tournament_teams ==========
DROP TABLE IF EXISTS tournament_teams;

-- ========== 6. RLS: teams (no longer have tournament_id) ==========
DROP POLICY IF EXISTS "Users can read teams for public tournaments" ON teams;
DROP POLICY IF EXISTS "Tournament admins and team managers can manage teams" ON teams;
CREATE POLICY "Tournament admins and team managers can manage teams"
    ON teams
    FOR ALL
    TO authenticated
    USING (
        team_manager_user_id = auth.uid()
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
        OR EXISTS (
            SELECT 1 FROM tournament_entries e
            JOIN user_permissions up ON up.tournament_id = e.tournament_id AND up.user_id = auth.uid() AND up.role_type = 'tournament_admin'
            WHERE e.team_id = teams.id
        )
    );

CREATE POLICY "Users can read teams for public tournaments"
    ON teams
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournament_entries e
            JOIN tournaments t ON t.id = e.tournament_id
            WHERE e.team_id = teams.id AND t.is_public = true
        )
    );

-- RLS: tournament_players (use entry_id -> tournament_entries.tournament_id)
DROP POLICY IF EXISTS "Tournament admins can manage tournament players" ON tournament_players;
CREATE POLICY "Tournament admins can manage tournament players"
    ON tournament_players
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournament_entries e
            JOIN tournaments t ON t.id = e.tournament_id
            WHERE e.id = tournament_players.entry_id
            AND (
                t.created_by_user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.tournament_id = e.tournament_id
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

-- RLS: tournament_pairs (use entry_id -> tournament_entries.tournament_id)
DROP POLICY IF EXISTS "Tournament admins can manage tournament pairs" ON tournament_pairs;
CREATE POLICY "Tournament admins can manage tournament pairs"
    ON tournament_pairs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tournament_entries e
            JOIN tournaments t ON t.id = e.tournament_id
            WHERE e.id = tournament_pairs.entry_id
            AND (
                t.created_by_user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = auth.uid()
                    AND up.tournament_id = e.tournament_id
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
