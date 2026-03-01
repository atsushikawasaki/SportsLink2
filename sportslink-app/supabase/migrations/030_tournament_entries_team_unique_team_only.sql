-- 団体戦のみ「同一大会で同一チーム1エントリー」を強制する。個人戦では同一代表チームから複数エントリーを許可する。
DROP INDEX IF EXISTS idx_tournament_entries_team_unique;
CREATE UNIQUE INDEX idx_tournament_entries_team_unique
    ON tournament_entries(tournament_id, team_id)
    WHERE entry_type = 'team' AND team_id IS NOT NULL;
