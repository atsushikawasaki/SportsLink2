-- audit_logs の performed_by が NULL のとき、ユーザー未設定（API/マイグレーション）時は
-- ゲスト審判ユーザーをフォールバックとして設定する（エラーにしない）
-- これによりドロー生成時の削除・挿入が performed_by エラーで失敗しなくなる

CREATE OR REPLACE FUNCTION public.set_audit_log_performed_by()
RETURNS TRIGGER AS $$
DECLARE
  fallback_user_id UUID := '11111111-1111-1111-1111-111111111111'; -- ゲスト審判（024 で登録）
BEGIN
  IF NEW.performed_by IS NULL THEN
    NEW.performed_by := auth.uid();
  END IF;
  IF NEW.performed_by IS NULL THEN
    NEW.performed_by := NULLIF(TRIM(current_setting('app.current_user_id', TRUE)), '')::uuid;
  END IF;
  -- API/マイグレーションなどユーザーコンテキストが無い場合はフォールバックを使用
  IF NEW.performed_by IS NULL THEN
    NEW.performed_by := fallback_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_audit_log_performed_by() IS
'Sets performed_by: auth.uid() -> app.current_user_id -> fallback (guest umpire). Allows server-side operations without user context.';
