-- Fix audit_logs performed_by NOT NULL constraint violation
-- Version: 1.0.0
-- This migration ensures performed_by is always set when inserting audit_logs
-- by creating a trigger that automatically sets performed_by to auth.uid() if NULL

-- Step 1: Create trigger function to set performed_by if NULL
CREATE OR REPLACE FUNCTION public.set_audit_log_performed_by()
RETURNS TRIGGER AS $$
BEGIN
    -- If performed_by is NULL, set it to current user ID
    IF NEW.performed_by IS NULL THEN
        NEW.performed_by := auth.uid();
    END IF;
    
    -- If still NULL (user not authenticated), raise an error
    -- This ensures data integrity
    IF NEW.performed_by IS NULL THEN
        RAISE EXCEPTION 'performed_by cannot be NULL for audit_logs. User must be authenticated.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS set_performed_by_on_audit_logs ON audit_logs;

-- Step 3: Create trigger to set performed_by before insert
CREATE TRIGGER set_performed_by_on_audit_logs
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_audit_log_performed_by();

-- Step 4: Add comment for documentation
COMMENT ON FUNCTION public.set_audit_log_performed_by() IS 
'Sets performed_by to current user ID (auth.uid()) if it is NULL when inserting audit_logs. Raises an error if user is not authenticated.';

