-- L6: エントリー削除時に match_slots.entry_id を SET NULL にし、CHECK を緩和する
-- tournament_entries 削除時、参照する match_slots の entry_id を null にし、スロットは「空き」として残す

ALTER TABLE match_slots DROP CONSTRAINT IF EXISTS match_slots_check;

ALTER TABLE match_slots ADD CONSTRAINT match_slots_check CHECK (
    (
        source_type = 'entry'
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
);

ALTER TABLE match_slots DROP CONSTRAINT IF EXISTS match_slots_entry_id_fkey;

ALTER TABLE match_slots
    ADD CONSTRAINT match_slots_entry_id_fkey
    FOREIGN KEY (entry_id) REFERENCES tournament_entries(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT match_slots_entry_id_fkey ON match_slots IS 'L6: Entry delete sets slot entry_id to NULL so draw integrity is preserved.';
