-- Add database triggers for automatic synchronization between auth.users and public.users
-- Version: 1.0.0
-- This migration adds triggers to automatically sync auth.users with public.users

-- Function to handle new user creation in auth.users
-- This function automatically creates a corresponding record in public.users
-- Note: password_hash and flags are not set by trigger (handled by application)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_user_id UUID;
  existing_user_email TEXT;
  existing_user_by_id UUID;
  existing_user_by_email UUID;
BEGIN
  -- Check if user exists by id
  SELECT id INTO existing_user_by_id
  FROM public.users
  WHERE id = NEW.id
  LIMIT 1;

  -- Check if user exists by email (different id)
  SELECT id INTO existing_user_by_email
  FROM public.users
  WHERE email = NEW.email AND id != NEW.id
  LIMIT 1;

  IF existing_user_by_id IS NOT NULL THEN
    -- User exists with same ID, just update email and display_name
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
    -- Log error but don't fail the auth.users insert
    -- This allows auth.users to be created even if public.users insert fails
    RAISE WARNING 'Error in handle_new_user trigger for user %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Trigger: Create public.users record when auth.users record is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to handle email updates in auth.users
-- This function automatically updates the email in public.users
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users
    SET email = NEW.email
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_user_email_update() TO authenticated;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;

-- Trigger: Update public.users email when auth.users email is updated
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW 
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.handle_user_email_update();

-- Function to handle user metadata updates
-- This function updates display_name when user_metadata is updated
CREATE OR REPLACE FUNCTION public.handle_user_metadata_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data THEN
    UPDATE public.users
    SET display_name = COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      public.users.display_name
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_user_metadata_update() TO authenticated;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_metadata_updated ON auth.users;

-- Trigger: Update display_name when user_metadata is updated
CREATE TRIGGER on_auth_user_metadata_updated
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW 
  WHEN (NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_user_metadata_update();

-- Note: User deletion is handled by CASCADE DELETE in the foreign key constraint
-- If you need custom deletion logic, you can add a trigger here

-- Optional: Function to sync existing auth.users to public.users
-- This can be run manually to sync existing data
CREATE OR REPLACE FUNCTION public.sync_existing_auth_users()
RETURNS INTEGER AS $$
DECLARE
  synced_count INTEGER := 0;
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    display_name,
    created_at
  )
  SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'display_name', ''),
    COALESCE((au.created_at)::timestamptz, NOW())
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name);
  
  GET DIAGNOSTICS synced_count = ROW_COUNT;
  RETURN synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission (only for service role in practice)
-- GRANT EXECUTE ON FUNCTION public.sync_existing_auth_users() TO service_role;

-- Comment: To sync existing users, run:
-- SELECT public.sync_existing_auth_users();

