-- Admin Custom Claims: user_permissions の admin ロール変更時に JWT の app_metadata を同期する

-- 関数: user の app_metadata の role を更新する
CREATE OR REPLACE FUNCTION sync_admin_custom_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
BEGIN
    -- INSERT/UPDATE の場合は NEW を、DELETE の場合は OLD を使用
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;

    -- このユーザーに admin ロールが存在するか確認
    SELECT EXISTS (
        SELECT 1 FROM user_permissions
        WHERE user_id = v_user_id
          AND role_type = 'admin'
          AND tournament_id IS NULL
          AND team_id IS NULL
          AND match_id IS NULL
    ) INTO v_is_admin;

    -- Supabase Admin API 経由で app_metadata を更新
    -- (auth.users テーブルに直接 UPDATE を実行)
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', CASE WHEN v_is_admin THEN 'admin' ELSE 'user' END)
    WHERE id = v_user_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- トリガー: user_permissions に admin ロールの変更があった場合のみ起動
DROP TRIGGER IF EXISTS on_admin_permission_change ON user_permissions;
CREATE TRIGGER on_admin_permission_change
    AFTER INSERT OR UPDATE OR DELETE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION sync_admin_custom_claim();

-- 既存の admin ユーザーの app_metadata を一括更新
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'admin')
WHERE id IN (
    SELECT DISTINCT user_id FROM user_permissions
    WHERE role_type = 'admin'
      AND tournament_id IS NULL
      AND team_id IS NULL
      AND match_id IS NULL
);
