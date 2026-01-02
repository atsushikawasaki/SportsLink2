-- Sport Link Database Migration
-- Version: 1.0.0
-- This migration creates all tables defined in the requirements specification
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    password_hash TEXT,
    master_flag BOOLEAN DEFAULT FALSE,
    master_manager_flag BOOLEAN DEFAULT FALSE,
    umpire_flag BOOLEAN DEFAULT FALSE,
    team_manager_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'finished')),
    is_public BOOLEAN DEFAULT FALSE,
    description TEXT,
    start_date DATE,
    end_date DATE,
    match_format TEXT CHECK (
        match_format IN (
            'team_doubles_3',
            'team_doubles_4_singles_1',
            'individual_doubles',
            'individual_singles'
        )
    ),
    umpire_mode TEXT DEFAULT 'LOSER' CHECK (umpire_mode IN ('LOSER', 'ASSIGNED', 'FREE')),
    created_by_user_id UUID REFERENCES users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- User Roles table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('tournament_admin', 'scorer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tournament_id)
);
-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    school_name TEXT NOT NULL,
    description TEXT,
    team_manager_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Tournament Players table
CREATE TABLE IF NOT EXISTS tournament_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    player_type TEXT CHECK (player_type IN ('前衛', '後衛', '両方')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Tournament Pairs table
CREATE TABLE IF NOT EXISTS tournament_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    pair_number INTEGER NOT NULL,
    player_1_id UUID REFERENCES tournament_players(id) NOT NULL,
    player_2_id UUID REFERENCES tournament_players(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tournament_id, team_id, pair_number),
    CHECK (
        player_2_id IS NULL
        OR player_1_id != player_2_id
    )
);
-- Tournament Phases table
CREATE TABLE IF NOT EXISTS tournament_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    phase_type TEXT NOT NULL CHECK (phase_type IN ('tournament', 'league')),
    name TEXT NOT NULL,
    sequence SMALLINT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tournament_id, sequence)
);
-- Tournament Groups table (for league phases)
CREATE TABLE IF NOT EXISTS tournament_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phase_id UUID REFERENCES tournament_phases(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    seed_bucket TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Tournament Entries table
CREATE TABLE IF NOT EXISTS tournament_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('team', 'pair')),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    pair_id UUID REFERENCES tournament_pairs(id) ON DELETE CASCADE,
    seed_rank SMALLINT,
    performance_score INTEGER,
    team_order SMALLINT,
    affiliation_key TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_checked_in BOOLEAN DEFAULT FALSE,
    day_token VARCHAR(4),
    last_checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        (
            entry_type = 'team'
            AND team_id IS NOT NULL
            AND pair_id IS NULL
        )
        OR (
            entry_type = 'pair'
            AND pair_id IS NOT NULL
        )
    )
);
-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    phase_id UUID REFERENCES tournament_phases(id),
    round_name TEXT NOT NULL,
    round_index SMALLINT,
    slot_index SMALLINT,
    match_number INTEGER,
    umpire_id UUID REFERENCES users(id),
    court_number INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'inprogress', 'finished')),
    version INTEGER DEFAULT 1,
    winner_next_match_id UUID REFERENCES matches(id),
    winner_next_slot SMALLINT,
    loser_next_match_id UUID REFERENCES matches(id),
    loser_next_slot SMALLINT,
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Match Pairs table
CREATE TABLE IF NOT EXISTS match_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
    pair_number INTEGER NOT NULL,
    team_id UUID REFERENCES teams(id) NOT NULL,
    player_1_id UUID REFERENCES tournament_players(id) NOT NULL,
    player_2_id UUID REFERENCES tournament_players(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (
        player_2_id IS NULL
        OR player_1_id != player_2_id
    )
);
-- Match Slots table
CREATE TABLE IF NOT EXISTS match_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
    slot_number SMALLINT NOT NULL CHECK (slot_number IN (1, 2)),
    source_type TEXT NOT NULL CHECK (
        source_type IN ('entry', 'winner', 'loser', 'bye')
    ),
    seed_position SMALLINT,
    entry_id UUID REFERENCES tournament_entries(id),
    source_match_id UUID REFERENCES matches(id),
    placeholder_label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (match_id, slot_number),
    CHECK (
        (
            source_type = 'entry'
            AND entry_id IS NOT NULL
            AND source_match_id IS NULL
        )
        OR (
            source_type IN ('winner', 'loser')
            AND source_match_id IS NOT NULL
        )
        OR (
            source_type = 'bye'
            AND entry_id IS NULL
            AND source_match_id IS NULL
        )
    )
);
-- Points table
CREATE TABLE IF NOT EXISTS points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    point_type TEXT CHECK (point_type IN ('A_score', 'B_score')),
    client_uuid UUID,
    server_received_at TIMESTAMPTZ DEFAULT NOW(),
    is_undone BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Match Scores table
CREATE TABLE IF NOT EXISTS match_scores (
    match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    game_count_a INTEGER DEFAULT 0,
    game_count_b INTEGER DEFAULT 0,
    final_score TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    operation_type TEXT CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_points_match_id ON points(match_id);
CREATE INDEX IF NOT EXISTS idx_points_server_received_at ON points(server_received_at);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_umpire_id ON matches(umpire_id);
CREATE INDEX IF NOT EXISTS idx_matches_phase_round_slot ON matches(phase_id, round_index, slot_index);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tournament_id ON user_roles(tournament_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON audit_logs(performed_at);
CREATE INDEX IF NOT EXISTS idx_tournament_pairs_tournament_id ON tournament_pairs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_pairs_team_id ON tournament_pairs(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_phases_sequence ON tournament_phases(tournament_id, sequence);
CREATE INDEX IF NOT EXISTS idx_tournament_phases_tournament_id ON tournament_phases(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_groups_phase_id ON tournament_groups(phase_id);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament_id ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_match_slots_match_id ON match_slots(match_id);