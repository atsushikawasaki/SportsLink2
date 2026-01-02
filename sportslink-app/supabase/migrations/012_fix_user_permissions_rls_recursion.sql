-- Fix infinite recursion in user_permissions RLS policies
-- Version: 1.0.0
-- This migration fixes the infinite recursion issue by simplifying the RLS policies
-- to avoid self-referencing user_permissions table

-- Step 1: Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can read their own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Tournament admins can read permissions for their tournaments" ON user_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON user_permissions;

-- Step 2: Create simplified policies that don't cause recursion
-- Users can read their own permissions (simple check, no recursion)
CREATE POLICY "Users can read their own permissions"
    ON user_permissions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Note: Admin and tournament admin checks are handled in application layer
-- using Admin Client to bypass RLS, so we don't need complex policies here
-- that would cause recursion.

-- For INSERT/UPDATE/DELETE, we rely on application layer checks
-- since Admin Client is used for permission management
CREATE POLICY "Users can manage their own permissions"
    ON user_permissions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Note: This policy allows users to manage only their own permissions.
-- Admin operations (managing other users' permissions) are handled via
-- Admin Client in the application layer, which bypasses RLS.

