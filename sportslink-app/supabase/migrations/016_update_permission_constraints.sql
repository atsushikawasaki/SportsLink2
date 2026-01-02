-- Update permission constraints to match new requirements
-- Version: 1.0.0
-- This migration updates the check_scope_exists constraint with stricter rules:
-- - admin: all scope fields must be NULL
-- - tournament_admin: tournament_id is required, team_id and match_id must be NULL
-- - team_admin: team_id is required, tournament_id and match_id must be NULL
-- - umpire: tournament_id is required, team_id must be NULL, match_id is optional (NULL allowed)

-- Step 1: Clean up invalid data before applying new constraints
-- This must be done BEFORE dropping the constraint to avoid constraint violations

-- 1.1: Fix team_admin permissions - remove tournament_id and match_id (only team_id should be set)
UPDATE user_permissions
SET tournament_id = NULL, match_id = NULL
WHERE role_type = 'team_admin'
    AND (tournament_id IS NOT NULL OR match_id IS NOT NULL);

-- 1.2: Delete any team_admin permissions without team_id (invalid)
DELETE FROM user_permissions
WHERE role_type = 'team_admin'
    AND team_id IS NULL;

-- 1.3: Delete any global umpire permissions (tournament_id is NULL) as they are no longer allowed
DELETE FROM user_permissions
WHERE role_type = 'umpire'
    AND tournament_id IS NULL;

-- 1.4: Fix umpire permissions - remove team_id (team_id must be NULL for umpire)
UPDATE user_permissions
SET team_id = NULL
WHERE role_type = 'umpire'
    AND team_id IS NOT NULL;

-- 1.5: Delete any umpire permissions without tournament_id (invalid)
DELETE FROM user_permissions
WHERE role_type = 'umpire'
    AND tournament_id IS NULL;

-- 1.6: Fix tournament_admin permissions - remove team_id and match_id
UPDATE user_permissions
SET team_id = NULL, match_id = NULL
WHERE role_type = 'tournament_admin'
    AND (team_id IS NOT NULL OR match_id IS NOT NULL);

-- 1.7: Delete any tournament_admin permissions without tournament_id (invalid)
DELETE FROM user_permissions
WHERE role_type = 'tournament_admin'
    AND tournament_id IS NULL;

-- 1.8: Fix admin permissions - ensure all scope fields are NULL
UPDATE user_permissions
SET tournament_id = NULL, team_id = NULL, match_id = NULL
WHERE role_type = 'admin'
    AND (tournament_id IS NOT NULL OR team_id IS NOT NULL OR match_id IS NOT NULL);

-- Step 2: Drop existing constraint
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS check_scope_exists;

-- Step 3: Create new constraint with stricter rules
ALTER TABLE user_permissions ADD CONSTRAINT check_scope_exists CHECK (
    -- admin: all scope fields must be NULL
    (role_type = 'admin' AND tournament_id IS NULL AND team_id IS NULL AND match_id IS NULL)
    OR
    -- tournament_admin: tournament_id is required, team_id and match_id must be NULL
    (role_type = 'tournament_admin' AND tournament_id IS NOT NULL AND team_id IS NULL AND match_id IS NULL)
    OR
    -- team_admin: team_id is required, tournament_id and match_id must be NULL
    (role_type = 'team_admin' AND team_id IS NOT NULL AND tournament_id IS NULL AND match_id IS NULL)
    OR
    -- umpire: tournament_id is required, team_id must be NULL, match_id is optional (NULL allowed)
    (role_type = 'umpire' AND tournament_id IS NOT NULL AND team_id IS NULL)
);

