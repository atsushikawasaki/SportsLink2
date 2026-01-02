-- Fix user ID mismatch between auth.users and public.users
-- This migration provides a function to sync users with mismatched IDs
-- Version: 1.0.0

-- Function to fix ID mismatches by updating public.users to match auth.users
-- This should be run manually after reviewing the conflicts
CREATE OR REPLACE FUNCTION public.fix_user_id_mismatches()
RETURNS TABLE(
  email TEXT,
  old_public_id UUID,
  new_auth_id UUID,
  status TEXT,
  affected_tables INTEGER[]
) AS $$
DECLARE
  user_record RECORD;
  affected_count INTEGER;
  affected_tables_list INTEGER[];
  old_email TEXT;
  old_display_name TEXT;
  old_password_hash TEXT;
  old_master_flag BOOLEAN;
  old_master_manager_flag BOOLEAN;
  old_umpire_flag BOOLEAN;
  old_team_manager_flag BOOLEAN;
  old_created_at TIMESTAMPTZ;
BEGIN
  -- Find users with email match but ID mismatch
  FOR user_record IN
    SELECT 
      au.id as auth_id,
      au.email,
      pu.id as public_id
    FROM auth.users au
    INNER JOIN public.users pu ON au.email = pu.email
    WHERE au.id != pu.id
  LOOP
    -- Count affected rows in related tables
    affected_count := 0;
    affected_tables_list := ARRAY[]::INTEGER[];
    
    -- Step 1: Get the old record data before we modify anything
    SELECT 
      pu.email, pu.display_name, pu.password_hash,
      pu.master_flag, pu.master_manager_flag, pu.umpire_flag, pu.team_manager_flag, pu.created_at
    INTO 
      old_email, old_display_name, old_password_hash,
      old_master_flag, old_master_manager_flag, old_umpire_flag, old_team_manager_flag, old_created_at
    FROM public.users pu
    WHERE pu.id = user_record.public_id;
    
    -- Step 2: Create new record with new ID first (using temporary email to avoid UNIQUE constraint)
    -- If new ID already exists, skip creation
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_record.auth_id) THEN
      -- Set app.current_user_id to public_id for UPDATE (it exists in public.users at this point)
      -- This satisfies the FK constraint for audit_logs
      PERFORM set_config('app.current_user_id', user_record.public_id::text, false);
      
      -- Temporarily change old record's email to avoid UNIQUE constraint
      UPDATE public.users
      SET email = 'temp_' || user_record.public_id::text || '@temp.com'
      WHERE id = user_record.public_id;
      
      -- Set app.current_user_id for INSERT (auth_id will exist after INSERT)
      PERFORM set_config('app.current_user_id', user_record.auth_id::text, false);
      
      -- Create new record with new ID
      INSERT INTO public.users (
        id, email, display_name, password_hash,
        master_flag, master_manager_flag, umpire_flag, team_manager_flag, created_at
      )
      VALUES (
        user_record.auth_id,
        old_email, old_display_name, old_password_hash,
        old_master_flag, old_master_manager_flag, old_umpire_flag, old_team_manager_flag, old_created_at
      );
    END IF;
    
    -- Step 3: Now update all related tables to use the new ID
    -- The new ID now exists in public.users, so foreign key constraints will be satisfied
    -- Each table update is wrapped in exception handling to continue even if one fails
    
    -- Check tournaments table
    BEGIN
      SELECT COUNT(*) INTO affected_count
      FROM public.tournaments
      WHERE created_by_user_id = user_record.public_id;
      IF affected_count > 0 THEN
        affected_tables_list := array_append(affected_tables_list, affected_count);
        -- Update tournaments
        UPDATE public.tournaments
        SET created_by_user_id = user_record.auth_id
        WHERE created_by_user_id = user_record.public_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to update tournaments table: %', SQLERRM;
    END;
    
    -- Check user_roles or userroles table (if exists)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name = 'user_roles' OR table_name = 'userroles')
    ) THEN
      BEGIN
        SELECT COUNT(*) INTO affected_count
        FROM public.user_roles
        WHERE user_id = user_record.public_id;
        IF affected_count > 0 THEN
          affected_tables_list := array_append(affected_tables_list, affected_count);
          -- Update user_roles
          UPDATE public.user_roles
          SET user_id = user_record.auth_id
          WHERE user_id = user_record.public_id;
        END IF;
      EXCEPTION
        WHEN undefined_table THEN
          BEGIN
            SELECT COUNT(*) INTO affected_count
            FROM public.userroles
            WHERE user_id = user_record.public_id;
            IF affected_count > 0 THEN
              affected_tables_list := array_append(affected_tables_list, affected_count);
              -- Update userroles
              -- Note: userroles table doesn't have an 'id' column, so audit trigger may fail
              -- Temporarily disable audit trigger to avoid OLD.id reference error
              BEGIN
                -- Try to disable audit trigger if it exists
                EXECUTE 'ALTER TABLE public.userroles DISABLE TRIGGER ALL';
                UPDATE public.userroles
                SET user_id = user_record.auth_id
                WHERE user_id = user_record.public_id;
                EXECUTE 'ALTER TABLE public.userroles ENABLE TRIGGER ALL';
              EXCEPTION
                WHEN OTHERS THEN
                  -- If disabling trigger fails, try to update without disabling trigger
                  -- This may fail if audit trigger requires OLD.id, but we'll catch the error
                  BEGIN
                    UPDATE public.userroles
                    SET user_id = user_record.auth_id
                    WHERE user_id = user_record.public_id;
                  EXCEPTION
                    WHEN OTHERS THEN
                      -- If audit trigger fails (e.g., OLD.id doesn't exist), log warning and continue
                      RAISE WARNING 'Failed to update userroles table (audit trigger may have failed): %', SQLERRM;
                  END;
              END;
            END IF;
          EXCEPTION
            WHEN undefined_table THEN
              -- Table doesn't exist, skip
              NULL;
          END;
      END;
    END IF;
    
    -- Check teams table
    BEGIN
      SELECT COUNT(*) INTO affected_count
      FROM public.teams
      WHERE team_manager_user_id = user_record.public_id;
      IF affected_count > 0 THEN
        affected_tables_list := array_append(affected_tables_list, affected_count);
        -- Update teams
        UPDATE public.teams
        SET team_manager_user_id = user_record.auth_id
        WHERE team_manager_user_id = user_record.public_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to update teams table: %', SQLERRM;
    END;
    
    -- Check matches table
    BEGIN
      SELECT COUNT(*) INTO affected_count
      FROM public.matches
      WHERE umpire_id = user_record.public_id;
      IF affected_count > 0 THEN
        affected_tables_list := array_append(affected_tables_list, affected_count);
        -- Update matches
        UPDATE public.matches
        SET umpire_id = user_record.auth_id
        WHERE umpire_id = user_record.public_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to update matches table: %', SQLERRM;
    END;
    
    -- Check audit_logs table
    BEGIN
      SELECT COUNT(*) INTO affected_count
      FROM public.audit_logs
      WHERE performed_by = user_record.public_id;
      IF affected_count > 0 THEN
        affected_tables_list := array_append(affected_tables_list, affected_count);
        -- Update audit_logs
        UPDATE public.audit_logs
        SET performed_by = user_record.auth_id
        WHERE performed_by = user_record.public_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to update audit_logs table: %', SQLERRM;
    END;
    
    -- Check user_consents table
    BEGIN
      SELECT COUNT(*) INTO affected_count
      FROM public.user_consents
      WHERE user_id = user_record.public_id;
      IF affected_count > 0 THEN
        affected_tables_list := array_append(affected_tables_list, affected_count);
        -- Update user_consents
        UPDATE public.user_consents
        SET user_id = user_record.auth_id
        WHERE user_id = user_record.public_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to update user_consents table: %', SQLERRM;
    END;
    
    -- Check contact_requests table (if exists)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'contact_requests'
    ) THEN
      BEGIN
        SELECT COUNT(*) INTO affected_count
        FROM public.contact_requests
        WHERE user_id = user_record.public_id;
        IF affected_count > 0 THEN
          affected_tables_list := array_append(affected_tables_list, affected_count);
          -- Update contact_requests
          UPDATE public.contact_requests
          SET user_id = user_record.auth_id
          WHERE user_id = user_record.public_id;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to update contact_requests table: %', SQLERRM;
      END;
    END IF;
    
    -- Step 4: Delete the old record (related tables are already updated, so this is safe)
    IF user_record.public_id != user_record.auth_id THEN
      -- Set app.current_user_id for audit_logs trigger
      PERFORM set_config('app.current_user_id', user_record.auth_id::text, false);
      DELETE FROM public.users WHERE id = user_record.public_id;
    END IF;
    
    -- Return the result
    email := user_record.email;
    old_public_id := user_record.public_id;
    new_auth_id := user_record.auth_id;
    status := 'Fixed';
    affected_tables := affected_tables_list;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission (only for service role in practice)
-- GRANT EXECUTE ON FUNCTION public.fix_user_id_mismatches() TO service_role;

-- Comment: To fix ID mismatches, run:
-- SELECT * FROM public.fix_user_id_mismatches();

-- Function to fix ID mismatch for a single user by email
-- This can be called from application code when creating auth.users from public.users
-- Drop existing function first to allow return type changes
DROP FUNCTION IF EXISTS public.fix_single_user_id_mismatch(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.fix_single_user_id_mismatch(
  user_email TEXT
)
RETURNS TABLE(
  result_email TEXT,
  result_previous_public_id UUID,
  result_new_auth_id UUID,
  result_status TEXT,
  result_affected_tables INTEGER[]
) AS $$
DECLARE
  user_rec RECORD;
  affected_count INTEGER;
  affected_tables_list INTEGER[];
  prev_email_val TEXT;
  prev_display_name_val TEXT;
  prev_password_hash_val TEXT;
  prev_master_flag_val BOOLEAN;
  prev_master_manager_flag_val BOOLEAN;
  prev_umpire_flag_val BOOLEAN;
  prev_team_manager_flag_val BOOLEAN;
  prev_created_at_val TIMESTAMPTZ;
BEGIN
  -- Find user with email match but ID mismatch
  SELECT 
    au.id as auth_id,
    au.email,
    pu.id as public_id
  INTO user_rec
  FROM auth.users au
  INNER JOIN public.users pu ON au.email = pu.email
  WHERE au.email = user_email
    AND au.id != pu.id
  LIMIT 1;
  
  -- If no mismatch found, return early
  IF user_rec IS NULL OR user_rec.auth_id IS NULL OR user_rec.public_id IS NULL THEN
    -- No mismatch found or invalid data
    result_email := user_email;
    result_previous_public_id := NULL;
    result_new_auth_id := NULL;
    result_status := 'No mismatch found';
    result_affected_tables := ARRAY[]::INTEGER[];
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Count affected rows in related tables
  affected_count := 0;
  affected_tables_list := ARRAY[]::INTEGER[];
  
  -- Step 1: Get the previous record data before we modify anything
  SELECT 
    pu.email, pu.display_name, pu.password_hash,
    pu.master_flag, pu.master_manager_flag, pu.umpire_flag, pu.team_manager_flag, pu.created_at
  INTO 
    prev_email_val, prev_display_name_val, prev_password_hash_val,
    prev_master_flag_val, prev_master_manager_flag_val, prev_umpire_flag_val, prev_team_manager_flag_val, prev_created_at_val
  FROM public.users pu
  WHERE pu.id = user_rec.public_id;
  
  -- If previous record not found, return error
  IF prev_email_val IS NULL THEN
    result_email := user_email;
    result_previous_public_id := user_rec.public_id;
    result_new_auth_id := user_rec.auth_id;
    result_status := 'Error: Previous record not found';
    result_affected_tables := ARRAY[]::INTEGER[];
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Step 2: Create new record with new ID first (using temporary email to avoid UNIQUE constraint)
  -- If new ID already exists, skip creation
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_rec.auth_id) THEN
    -- Set app.current_user_id to public_id for UPDATE (it exists in public.users at this point)
    -- This satisfies the FK constraint for audit_logs
    PERFORM set_config('app.current_user_id', user_rec.public_id::text, false);
    
    -- Temporarily change previous record's email to avoid UNIQUE constraint
    UPDATE public.users
    SET email = 'temp_' || user_rec.public_id::text || '@temp.com'
    WHERE id = user_rec.public_id;
    
    -- Set app.current_user_id for INSERT (auth_id will exist after INSERT)
    PERFORM set_config('app.current_user_id', user_rec.auth_id::text, false);
    
    -- Create new record with new ID
    INSERT INTO public.users (
      id, email, display_name, password_hash,
      master_flag, master_manager_flag, umpire_flag, team_manager_flag, created_at
    )
    VALUES (
      user_rec.auth_id,
      prev_email_val, prev_display_name_val, prev_password_hash_val,
      prev_master_flag_val, prev_master_manager_flag_val, prev_umpire_flag_val, prev_team_manager_flag_val, prev_created_at_val
    );
  END IF;
  
  -- Step 3: Now update all related tables to use the new ID
  -- The new ID now exists in public.users, so foreign key constraints will be satisfied
  -- Each table update is wrapped in exception handling to continue even if one fails
  
  -- Check tournaments table
  BEGIN
    SELECT COUNT(*) INTO affected_count
    FROM public.tournaments
    WHERE created_by_user_id = user_rec.public_id;
    IF affected_count > 0 THEN
      affected_tables_list := array_append(affected_tables_list, affected_count);
      -- Update tournaments
      UPDATE public.tournaments
      SET created_by_user_id = user_rec.auth_id
      WHERE created_by_user_id = user_rec.public_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to update tournaments table: %', SQLERRM;
  END;
  
  -- Check user_roles or userroles table
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    BEGIN
      SELECT COUNT(*) INTO affected_count
      FROM public.user_roles
      WHERE user_id = user_rec.public_id;
    IF affected_count > 0 THEN
      affected_tables_list := array_append(affected_tables_list, affected_count);
      -- Update user_roles
      UPDATE public.user_roles
      SET user_id = user_rec.auth_id
      WHERE user_id = user_rec.public_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to update user_roles table: %', SQLERRM;
  END;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'userroles'
  ) THEN
    BEGIN
      SELECT COUNT(*) INTO affected_count
      FROM public.userroles
      WHERE user_id = user_rec.public_id;
    IF affected_count > 0 THEN
      affected_tables_list := array_append(affected_tables_list, affected_count);
      -- Update userroles
      -- Note: userroles table doesn't have an 'id' column, so audit trigger may fail
      -- Temporarily disable audit trigger to avoid OLD.id reference error
      BEGIN
        -- Try to disable audit trigger if it exists
        EXECUTE 'ALTER TABLE public.userroles DISABLE TRIGGER ALL';
        UPDATE public.userroles
        SET user_id = user_rec.auth_id
        WHERE user_id = user_rec.public_id;
        EXECUTE 'ALTER TABLE public.userroles ENABLE TRIGGER ALL';
      EXCEPTION
        WHEN OTHERS THEN
          -- If disabling trigger fails, try to update without disabling trigger
          -- This may fail if audit trigger requires OLD.id, but we'll catch the error
          BEGIN
            UPDATE public.userroles
            SET user_id = user_rec.auth_id
            WHERE user_id = user_rec.public_id;
          EXCEPTION
            WHEN OTHERS THEN
              -- If audit trigger fails (e.g., OLD.id doesn't exist), log warning and continue
              RAISE WARNING 'Failed to update userroles table (audit trigger may have failed): %', SQLERRM;
          END;
      END;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to update userroles table: %', SQLERRM;
  END;
  END IF;
  
  -- Check teams table
  BEGIN
    SELECT COUNT(*) INTO affected_count
    FROM public.teams
    WHERE team_manager_user_id = user_rec.public_id;
    IF affected_count > 0 THEN
      affected_tables_list := array_append(affected_tables_list, affected_count);
      -- Update teams
      UPDATE public.teams
      SET team_manager_user_id = user_rec.auth_id
      WHERE team_manager_user_id = user_rec.public_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to update teams table: %', SQLERRM;
  END;
  
  -- Check matches table
  BEGIN
    SELECT COUNT(*) INTO affected_count
    FROM public.matches
    WHERE umpire_id = user_rec.public_id;
    IF affected_count > 0 THEN
      affected_tables_list := array_append(affected_tables_list, affected_count);
      -- Update matches
      UPDATE public.matches
      SET umpire_id = user_rec.auth_id
      WHERE umpire_id = user_rec.public_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to update matches table: %', SQLERRM;
  END;
  
  -- Check audit_logs table
  BEGIN
    SELECT COUNT(*) INTO affected_count
    FROM public.audit_logs
    WHERE performed_by = user_rec.public_id;
    IF affected_count > 0 THEN
      affected_tables_list := array_append(affected_tables_list, affected_count);
      -- Update audit_logs
      UPDATE public.audit_logs
      SET performed_by = user_rec.auth_id
      WHERE performed_by = user_rec.public_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to update audit_logs table: %', SQLERRM;
  END;
  
  -- Check user_consents table
  BEGIN
    SELECT COUNT(*) INTO affected_count
    FROM public.user_consents
    WHERE user_id = user_rec.public_id;
    IF affected_count > 0 THEN
      affected_tables_list := array_append(affected_tables_list, affected_count);
      -- Update user_consents
      UPDATE public.user_consents
      SET user_id = user_rec.auth_id
      WHERE user_id = user_rec.public_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to update user_consents table: %', SQLERRM;
  END;
  
  -- Check contact_requests table (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'contact_requests'
  ) THEN
    BEGIN
      SELECT COUNT(*) INTO affected_count
      FROM public.contact_requests
      WHERE user_id = user_rec.public_id;
      IF affected_count > 0 THEN
        affected_tables_list := array_append(affected_tables_list, affected_count);
        -- Update contact_requests
        UPDATE public.contact_requests
        SET user_id = user_rec.auth_id
        WHERE user_id = user_rec.public_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to update contact_requests table: %', SQLERRM;
    END;
  END IF;
  
  -- Step 4: Delete the previous record (related tables are already updated, so this is safe)
  IF user_rec.public_id != user_rec.auth_id THEN
    -- Set app.current_user_id for audit_logs trigger
    PERFORM set_config('app.current_user_id', user_rec.auth_id::text, false);
    DELETE FROM public.users WHERE id = user_rec.public_id;
  END IF;
  
  -- Return the result
  result_email := COALESCE(user_rec.email, user_email);
  result_previous_public_id := user_rec.public_id;
  result_new_auth_id := user_rec.auth_id;
  result_status := 'Fixed';
  result_affected_tables := COALESCE(affected_tables_list, ARRAY[]::INTEGER[]);
  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.fix_single_user_id_mismatch(TEXT) TO authenticated;

-- Comment: To fix ID mismatch for a single user, run:
-- SELECT * FROM public.fix_single_user_id_mismatch('user@example.com');

-- Function to check for ID mismatches without fixing them
CREATE OR REPLACE FUNCTION public.check_user_id_mismatches()
RETURNS TABLE(
  email TEXT,
  public_users_id UUID,
  auth_users_id UUID,
  conflict_count INTEGER
) AS $$
DECLARE
  user_roles_count INTEGER := 0;
  user_record RECORD;
BEGIN
  -- Check if user_roles or userroles table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name = 'user_roles' OR table_name = 'userroles')
  ) THEN
    -- Process each user with ID mismatch
    FOR user_record IN
      SELECT 
        au.email,
        pu.id as public_users_id,
        au.id as auth_users_id
      FROM auth.users au
      INNER JOIN public.users pu ON au.email = pu.email
      WHERE au.id != pu.id
    LOOP
      -- Count conflicts for each table
      user_roles_count := 0;
      
      -- Count user_roles (if table exists, already checked above)
      -- Try user_roles first, then userroles
      BEGIN
        SELECT COUNT(*) INTO user_roles_count
        FROM public.user_roles
        WHERE user_id = user_record.public_users_id;
      EXCEPTION
        WHEN undefined_table THEN
          BEGIN
            SELECT COUNT(*) INTO user_roles_count
            FROM public.userroles
            WHERE user_id = user_record.public_users_id;
          EXCEPTION
            WHEN undefined_table THEN
              user_roles_count := 0;
          END;
      END;
      
      -- Return the result
      email := user_record.email;
      public_users_id := user_record.public_users_id;
      auth_users_id := user_record.auth_users_id;
      conflict_count := (
        (SELECT COUNT(*) FROM public.tournaments WHERE created_by_user_id = user_record.public_users_id) +
        user_roles_count +
        (SELECT COUNT(*) FROM public.teams WHERE team_manager_user_id = user_record.public_users_id) +
        (SELECT COUNT(*) FROM public.matches WHERE umpire_id = user_record.public_users_id) +
        (SELECT COUNT(*) FROM public.audit_logs WHERE performed_by = user_record.public_users_id) +
        (SELECT COUNT(*) FROM public.user_consents WHERE user_id = user_record.public_users_id) +
        COALESCE((
          SELECT COUNT(*) FROM public.contact_requests 
          WHERE user_id = user_record.public_users_id
          AND EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'contact_requests'
          )
        ), 0)
      )::INTEGER;
      RETURN NEXT;
    END LOOP;
  ELSE
    -- user_roles table doesn't exist, process without it
    FOR user_record IN
      SELECT 
        au.email,
        pu.id as public_users_id,
        au.id as auth_users_id
      FROM auth.users au
      INNER JOIN public.users pu ON au.email = pu.email
      WHERE au.id != pu.id
    LOOP
      email := user_record.email;
      public_users_id := user_record.public_users_id;
      auth_users_id := user_record.auth_users_id;
      conflict_count := (
        (SELECT COUNT(*) FROM public.tournaments WHERE created_by_user_id = user_record.public_users_id) +
        (SELECT COUNT(*) FROM public.teams WHERE team_manager_user_id = user_record.public_users_id) +
        (SELECT COUNT(*) FROM public.matches WHERE umpire_id = user_record.public_users_id) +
        (SELECT COUNT(*) FROM public.audit_logs WHERE performed_by = user_record.public_users_id) +
        (SELECT COUNT(*) FROM public.user_consents WHERE user_id = user_record.public_users_id) +
        COALESCE((
          SELECT COUNT(*) FROM public.contact_requests 
          WHERE user_id = user_record.public_users_id
          AND EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'contact_requests'
          )
        ), 0)
      )::INTEGER;
      RETURN NEXT;
    END LOOP;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_user_id_mismatches() TO authenticated;

-- Comment: To check for ID mismatches, run:
-- SELECT * FROM public.check_user_id_mismatches();

