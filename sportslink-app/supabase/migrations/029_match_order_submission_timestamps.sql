-- 団体戦オーダー提出: スロット1/2それぞれの提出完了時刻を記録（両者提出まで秘匿するため）
ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS order_submitted_slot_1_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS order_submitted_slot_2_at TIMESTAMPTZ;

COMMENT ON COLUMN matches.order_submitted_slot_1_at IS 'Slot 1 (pair_number=1) のオーダー提出完了日時。両方設定済みになるまで相手に開示しない。';
COMMENT ON COLUMN matches.order_submitted_slot_2_at IS 'Slot 2 (pair_number=2) のオーダー提出完了日時。';
