-- Fix umpire global permission constraint
-- Version: 1.0.1
-- This migration fixes the check_scope_exists constraint to allow global umpire permissions

-- Drop the existing constraint
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS check_scope_exists;

-- Recreate the constraint with updated logic
-- - admin role must have all scope fields NULL
-- - umpire role can have all scope fields NULL (global umpire) or specific scope
-- - other roles (tournament_admin, team_admin) must have at least one scope
ALTER TABLE user_permissions
ADD CONSTRAINT check_scope_exists CHECK (
    (role_type = 'admin' AND tournament_id IS NULL AND team_id IS NULL AND match_id IS NULL)
    OR (role_type = 'umpire')
    OR (role_type IN ('tournament_admin', 'team_admin') AND (tournament_id IS NOT NULL OR team_id IS NOT NULL OR match_id IS NOT NULL))
);

