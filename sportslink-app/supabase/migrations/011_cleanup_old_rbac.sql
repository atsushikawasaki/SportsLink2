-- Cleanup old RBAC system
-- Version: 1.0.0
-- This migration removes old userroles table and flag columns from users table

-- Step 1: Drop old userroles table (if exists)
-- Check for both userroles and user_roles table names for compatibility
DO $$
BEGIN
    -- Drop userroles table (without underscore)
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'userroles'
    ) THEN
        -- Drop RLS policies first
        DROP POLICY IF EXISTS "Users can read their own roles" ON userroles;
        DROP POLICY IF EXISTS "Tournament admins can manage roles" ON userroles;
        
        -- Drop the table
        DROP TABLE userroles CASCADE;
        RAISE NOTICE 'Dropped userroles table';
    END IF;
    
    -- Drop user_roles table (with underscore) as fallback
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_roles'
    ) THEN
        -- Drop RLS policies first
        DROP POLICY IF EXISTS "Users can read their own roles" ON user_roles;
        DROP POLICY IF EXISTS "Tournament admins can manage roles" ON user_roles;
        
        -- Drop the table
        DROP TABLE user_roles CASCADE;
        RAISE NOTICE 'Dropped user_roles table';
    END IF;
END $$;

-- Step 2: Update audit_logs RLS policy to use new permission system
-- Drop old policy that depends on master_flag
DROP POLICY IF EXISTS "Only system admins can view audit logs" ON audit_logs;

-- Create new policy using user_permissions
CREATE POLICY "Only system admins can view audit logs"
    ON audit_logs
    FOR SELECT
    TO authenticated
    USING (
        -- Users can read their own audit logs
        performed_by = auth.uid()
        OR EXISTS (
            -- System admins (admin role) can read all audit logs
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.role_type = 'admin'
            AND up.tournament_id IS NULL
            AND up.team_id IS NULL
            AND up.match_id IS NULL
        )
    );

-- Step 3: Remove flag columns from users table
-- These columns are no longer needed as permissions are managed in user_permissions table
DO $$
BEGIN
    -- Drop master_flag column
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'master_flag'
    ) THEN
        ALTER TABLE users DROP COLUMN master_flag;
        RAISE NOTICE 'Dropped master_flag column';
    END IF;
    
    -- Drop master_manager_flag column
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'master_manager_flag'
    ) THEN
        ALTER TABLE users DROP COLUMN master_manager_flag;
        RAISE NOTICE 'Dropped master_manager_flag column';
    END IF;
    
    -- Drop umpire_flag column
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'umpire_flag'
    ) THEN
        ALTER TABLE users DROP COLUMN umpire_flag;
        RAISE NOTICE 'Dropped umpire_flag column';
    END IF;
    
    -- Drop team_manager_flag column
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'team_manager_flag'
    ) THEN
        ALTER TABLE users DROP COLUMN team_manager_flag;
        RAISE NOTICE 'Dropped team_manager_flag column';
    END IF;
END $$;

-- Step 4: Update auth sync trigger to remove flag references
-- Recreate the function without flag columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_user_by_id UUID;
  existing_user_by_email UUID;
BEGIN
  -- Check if user already exists by ID
  SELECT id INTO existing_user_by_id
  FROM public.users
  WHERE id = NEW.id;
  
  -- Check if user already exists by email
  SELECT id INTO existing_user_by_email
  FROM public.users
  WHERE email = NEW.email;
  
  IF existing_user_by_id IS NOT NULL THEN
    -- User exists with same ID, update email and display_name
    UPDATE public.users
    SET 
      email = NEW.email,
      display_name = COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        public.users.display_name
      )
    WHERE id = NEW.id;
  ELSIF existing_user_by_email IS NOT NULL THEN
    -- User exists with same email but different ID
    -- This is a conflict situation - log warning but don't fail
    -- The application layer should handle this case
    RAISE WARNING 'User with email % already exists with different ID (existing: %, new: %). Manual sync required.', 
      NEW.email, existing_user_by_email, NEW.id;
    
    -- Try to update the existing user's ID (may fail due to foreign key constraints)
    -- If it fails, the warning will be logged and auth.users creation will succeed
    BEGIN
      UPDATE public.users
      SET 
        id = NEW.id,
        email = NEW.email,
        display_name = COALESCE(
          NEW.raw_user_meta_data->>'display_name',
          public.users.display_name
        )
      WHERE id = existing_user_by_email;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to update user ID from % to % for email %: %', 
          existing_user_by_email, NEW.id, NEW.email, SQLERRM;
    END;
  ELSE
    -- User doesn't exist, insert new record
    INSERT INTO public.users (
      id, 
      email, 
      display_name, 
      created_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
      COALESCE((NEW.created_at)::timestamptz, NOW())
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail auth.users creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

