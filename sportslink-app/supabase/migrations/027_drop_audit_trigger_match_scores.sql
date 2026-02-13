-- match_scores は主キーが match_id であり id 列がない。
-- 監査トリガーが OLD.id を参照していると、matches 削除時の CASCADE で
-- "record \"old\" has no field \"id\"" が発生するため、該当トリガーを削除する。

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT t.tgname AS trigger_name,
               t.tgrelid::regclass::text AS table_name
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE t.tgrelid IN ('public.match_scores'::regclass, 'public.points'::regclass)
          AND NOT t.tgisinternal
          AND (p.prosrc LIKE '%OLD.id%' OR p.prosrc LIKE '%OLD\.id%')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.trigger_name, r.table_name);
        RAISE NOTICE 'Dropped trigger % on % (uses OLD.id)', r.trigger_name, r.table_name;
    END LOOP;
END $$;
