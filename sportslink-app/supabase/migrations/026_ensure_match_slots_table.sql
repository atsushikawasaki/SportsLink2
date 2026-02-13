-- Ensure public.match_slots exists (for projects where it was missing from schema cache or 001 was skipped)
-- PostgREST schema cache: after running this migration, reload the schema in Supabase Dashboard (Settings -> API -> Reload schema) if needed.

CREATE TABLE IF NOT EXISTS public.match_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_match_slots_match_id ON public.match_slots(match_id);

COMMENT ON TABLE public.match_slots IS 'Draw slots per match (entry/winner/loser/bye). Ensured by 026 for schema cache visibility.';
