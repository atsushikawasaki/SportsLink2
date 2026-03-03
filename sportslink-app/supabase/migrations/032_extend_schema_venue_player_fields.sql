-- tournaments テーブルに会場フィールドを追加
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS venue TEXT;

-- tournament_players テーブルに選手追加フィールドを追加
ALTER TABLE tournament_players
    ADD COLUMN IF NOT EXISTS player_name_kana TEXT,
    ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    ADD COLUMN IF NOT EXISTS birthdate DATE,
    ADD COLUMN IF NOT EXISTS player_email TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS registration_id TEXT;
