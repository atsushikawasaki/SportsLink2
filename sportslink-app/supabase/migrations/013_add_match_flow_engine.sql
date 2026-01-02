-- Match Flow Engine Migration
-- Version: 1.0.0
-- This migration adds support for team matches, automatic win/loss determination,
-- and automatic progression to next rounds

-- Step 1: Extend matches table
ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS parent_match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS match_type TEXT CHECK (match_type IN ('team_match', 'individual_match')),
    ADD COLUMN IF NOT EXISTS next_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS winner_source_match_a UUID REFERENCES matches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS winner_source_match_b UUID REFERENCES matches(id) ON DELETE SET NULL;

-- Step 2: Extend match_scores table
ALTER TABLE match_scores
    ADD COLUMN IF NOT EXISTS winner_id UUID,
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS winning_reason TEXT CHECK (winning_reason IN ('NORMAL', 'RETIRE', 'DEFAULT'));

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_matches_parent_match_id ON matches(parent_match_id) WHERE parent_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_next_match_id ON matches(next_match_id) WHERE next_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_winner_source_match_a ON matches(winner_source_match_a) WHERE winner_source_match_a IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_winner_source_match_b ON matches(winner_source_match_b) WHERE winner_source_match_b IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_scores_winner_id ON match_scores(winner_id) WHERE winner_id IS NOT NULL;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN matches.parent_match_id IS 'Parent match ID for team matches. NULL for individual matches or top-level team matches.';
COMMENT ON COLUMN matches.match_type IS 'Type of match: team_match (parent) or individual_match (child or standalone)';
COMMENT ON COLUMN matches.next_match_id IS 'Next match ID where the winner of this match will advance';
COMMENT ON COLUMN matches.winner_source_match_a IS 'Match ID whose winner will fill slot A of this match';
COMMENT ON COLUMN matches.winner_source_match_b IS 'Match ID whose winner will fill slot B of this match';
COMMENT ON COLUMN match_scores.winner_id IS 'Winner ID (team_id or pair_id)';
COMMENT ON COLUMN match_scores.ended_at IS 'Timestamp when the match ended';
COMMENT ON COLUMN match_scores.winning_reason IS 'Reason for winning: NORMAL, RETIRE, or DEFAULT';

