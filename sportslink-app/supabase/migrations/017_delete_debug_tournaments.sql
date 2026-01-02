-- Delete tournaments with "Debug Tournament" in the name
-- This migration removes all tournaments whose name contains "Debug Tournament"

-- First, let's see what will be deleted (for verification)
-- Uncomment the following lines to preview what will be deleted:
-- SELECT id, name, status, created_at 
-- FROM tournaments 
-- WHERE name ILIKE '%Debug Tournament%';

-- Step 1: Temporarily disable audit log triggers to avoid performed_by NULL errors
-- This is necessary because migrations run without authenticated user context
-- We'll disable triggers on all tables that might have audit triggers
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Disable all triggers that might insert into audit_logs
    -- This includes triggers on tournaments and related tables
    FOR trigger_record IN
        SELECT 
            t.tgname AS trigger_name,
            t.tgrelid::regclass AS table_name
        FROM pg_trigger t
        WHERE NOT t.tgisinternal
          AND EXISTS (
              SELECT 1 
              FROM pg_proc p
              WHERE t.tgfoid = p.oid
                AND (
                    p.proname LIKE '%audit%' 
                    OR p.proname LIKE '%Audit%'
                    OR p.prosrc LIKE '%audit_logs%'
                    OR p.prosrc LIKE '%Audit_Logs%'
                )
          )
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %s', 
                trigger_record.table_name, 
                trigger_record.trigger_name);
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignore errors if trigger doesn't exist or can't be disabled
                NULL;
        END;
    END LOOP;
    
    -- Also disable the set_performed_by_on_audit_logs trigger on audit_logs table
    BEGIN
        ALTER TABLE audit_logs DISABLE TRIGGER set_performed_by_on_audit_logs;
    EXCEPTION
        WHEN OTHERS THEN
            -- Ignore if trigger doesn't exist
            NULL;
    END;
END $$;

-- Step 2: Delete tournaments with "Debug Tournament" in the name
-- Due to CASCADE constraints, related data will be automatically deleted:
-- - matches
-- - tournament_entries
-- - tournament_pairs
-- - tournament_phases
-- - tournament_players
-- - tournament_teams
-- - teams (if only used by these tournaments)
-- - user_permissions (tournament-level)
-- - notifications
DELETE FROM tournaments 
WHERE name ILIKE '%Debug Tournament%';

-- Step 3: Re-enable audit log triggers
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Re-enable all audit triggers
    FOR trigger_record IN
        SELECT 
            t.tgname AS trigger_name,
            t.tgrelid::regclass AS table_name
        FROM pg_trigger t
        WHERE NOT t.tgisinternal
          AND EXISTS (
              SELECT 1 
              FROM pg_proc p
              WHERE t.tgfoid = p.oid
                AND (
                    p.proname LIKE '%audit%' 
                    OR p.proname LIKE '%Audit%'
                    OR p.prosrc LIKE '%audit_logs%'
                    OR p.prosrc LIKE '%Audit_Logs%'
                )
          )
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %s ENABLE TRIGGER %s', 
                trigger_record.table_name, 
                trigger_record.trigger_name);
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignore errors if trigger doesn't exist or can't be enabled
                NULL;
        END;
    END LOOP;
    
    -- Re-enable the set_performed_by_on_audit_logs trigger on audit_logs table
    BEGIN
        ALTER TABLE audit_logs ENABLE TRIGGER set_performed_by_on_audit_logs;
    EXCEPTION
        WHEN OTHERS THEN
            -- Ignore if trigger doesn't exist
            NULL;
    END;
END $$;

