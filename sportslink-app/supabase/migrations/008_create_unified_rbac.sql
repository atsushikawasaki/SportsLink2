-- Unified RBAC Migration
-- Version: 1.0.0
-- This migration creates the unified permission management system (user_permissions table)
-- and migrates data from users flags and userroles table

-- Step 1: Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL CHECK (role_type IN ('admin', 'tournament_admin', 'team_admin', 'umpire')),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: same user cannot have duplicate permission entries
    CONSTRAINT unique_user_permission UNIQUE (user_id, role_type, tournament_id, team_id, match_id),
    
    -- Check constraint: 
    -- - admin role must have all scope fields NULL
    -- - umpire role can have all scope fields NULL (global umpire) or specific scope
    -- - other roles (tournament_admin, team_admin) must have at least one scope
    CONSTRAINT check_scope_exists CHECK (
        (role_type = 'admin' AND tournament_id IS NULL AND team_id IS NULL AND match_id IS NULL)
        OR (role_type = 'umpire')
        OR (role_type IN ('tournament_admin', 'team_admin') AND (tournament_id IS NOT NULL OR team_id IS NOT NULL OR match_id IS NOT NULL))
    )
);

-- Step 2: Create indexes for performance
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_user_tournament_role ON user_permissions(user_id, tournament_id, role_type);
CREATE INDEX idx_user_permissions_tournament_id ON user_permissions(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX idx_user_permissions_team_id ON user_permissions(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_user_permissions_match_id ON user_permissions(match_id) WHERE match_id IS NOT NULL;

-- Step 3: Enable RLS on user_permissions table
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for user_permissions
-- Users can read their own permissions
CREATE POLICY "Users can read their own permissions"
    ON user_permissions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Admin users can read all permissions (handled via admin role check in application layer)
-- Tournament admins can read permissions for their tournaments
CREATE POLICY "Tournament admins can read permissions for their tournaments"
    ON user_permissions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.role_type = 'admin'
            AND up.tournament_id IS NULL
            AND up.team_id IS NULL
            AND up.match_id IS NULL
        )
        OR EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.role_type = 'tournament_admin'
            AND up.tournament_id = user_permissions.tournament_id
        )
    );

-- Only admins can insert/update/delete permissions (handled in application layer)
-- For now, allow authenticated users to manage permissions (application layer will enforce admin check)
CREATE POLICY "Admins can manage permissions"
    ON user_permissions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = auth.uid()
            AND up.role_type = 'admin'
            AND up.tournament_id IS NULL
            AND up.team_id IS NULL
            AND up.match_id IS NULL
        )
    );

-- Step 5: Data migration from users flags to user_permissions
-- Migrate master_flag to admin role
INSERT INTO user_permissions (user_id, role_type, tournament_id, team_id, match_id, created_at)
SELECT 
    id,
    'admin',
    NULL,
    NULL,
    NULL,
    created_at
FROM users
WHERE master_flag = TRUE
ON CONFLICT (user_id, role_type, tournament_id, team_id, match_id) DO NOTHING;

-- Migrate master_manager_flag to admin role (if not already migrated from master_flag)
INSERT INTO user_permissions (user_id, role_type, tournament_id, team_id, match_id, created_at)
SELECT 
    id,
    'admin',
    NULL,
    NULL,
    NULL,
    created_at
FROM users
WHERE master_manager_flag = TRUE
ON CONFLICT (user_id, role_type, tournament_id, team_id, match_id) DO NOTHING;

-- Migrate umpire_flag to global umpire role (tournament_id = NULL means global umpire)
-- Note: This creates a global umpire permission. Tournament-specific umpires will be created from userroles
INSERT INTO user_permissions (user_id, role_type, tournament_id, team_id, match_id, created_at)
SELECT 
    id,
    'umpire',
    NULL,
    NULL,
    NULL,
    created_at
FROM users
WHERE umpire_flag = TRUE
ON CONFLICT (user_id, role_type, tournament_id, team_id, match_id) DO NOTHING;

-- Step 6: Data migration from userroles to user_permissions
-- Only migrate if userroles table exists (check both user_roles and userroles for compatibility)
DO $$
BEGIN
    -- Check for userroles table (without underscore)
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'userroles'
    ) THEN
        -- Migrate tournament_admin role from userroles table
        INSERT INTO user_permissions (user_id, role_type, tournament_id, team_id, match_id, created_at)
        SELECT 
            user_id,
            'tournament_admin',
            tournament_id,
            NULL,
            NULL,
            created_at
        FROM userroles
        WHERE role = 'tournament_admin'
        ON CONFLICT (user_id, role_type, tournament_id, team_id, match_id) DO NOTHING;

        -- Migrate scorer role to umpire role (scorer is renamed to umpire in new system)
        INSERT INTO user_permissions (user_id, role_type, tournament_id, team_id, match_id, created_at)
        SELECT 
            user_id,
            'umpire',
            tournament_id,
            NULL,
            NULL,
            created_at
        FROM userroles
        WHERE role = 'scorer'
        ON CONFLICT (user_id, role_type, tournament_id, team_id, match_id) DO NOTHING;
    -- Check for user_roles table (with underscore) as fallback
    ELSIF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_roles'
    ) THEN
        -- Migrate tournament_admin role from user_roles table
        INSERT INTO user_permissions (user_id, role_type, tournament_id, team_id, match_id, created_at)
        SELECT 
            user_id,
            'tournament_admin',
            tournament_id,
            NULL,
            NULL,
            created_at
        FROM user_roles
        WHERE role = 'tournament_admin'
        ON CONFLICT (user_id, role_type, tournament_id, team_id, match_id) DO NOTHING;

        -- Migrate scorer role to umpire role (scorer is renamed to umpire in new system)
        INSERT INTO user_permissions (user_id, role_type, tournament_id, team_id, match_id, created_at)
        SELECT 
            user_id,
            'umpire',
            tournament_id,
            NULL,
            NULL,
            created_at
        FROM user_roles
        WHERE role = 'scorer'
        ON CONFLICT (user_id, role_type, tournament_id, team_id, match_id) DO NOTHING;
    END IF;
END $$;

-- Step 7: Migrate team_manager_flag to team_admin role
-- Note: This requires joining with teams table to get team_id
-- Since team_manager_flag is global, we'll create team_admin permissions for all teams where user is team_manager
-- Only migrate if teams table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'teams'
    ) THEN
        INSERT INTO user_permissions (user_id, role_type, tournament_id, team_id, match_id, created_at)
        SELECT 
            t.team_manager_user_id,
            'team_admin',
            t.tournament_id,
            t.id,
            NULL,
            t.created_at
        FROM teams t
        WHERE t.team_manager_user_id IS NOT NULL
        ON CONFLICT (user_id, role_type, tournament_id, team_id, match_id) DO NOTHING;
    END IF;
END $$;

-- Step 8: Create helper function to check permissions
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_role_type TEXT,
    p_tournament_id UUID DEFAULT NULL,
    p_team_id UUID DEFAULT NULL,
    p_match_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    has_admin_role BOOLEAN;
    has_permission BOOLEAN;
BEGIN
    -- Check if user has admin role (admin has all permissions)
    SELECT EXISTS (
        SELECT 1 FROM user_permissions
        WHERE user_id = p_user_id
        AND role_type = 'admin'
        AND tournament_id IS NULL
        AND team_id IS NULL
        AND match_id IS NULL
    ) INTO has_admin_role;
    
    IF has_admin_role THEN
        RETURN TRUE;
    END IF;
    
    -- Check specific permission
    SELECT EXISTS (
        SELECT 1 FROM user_permissions
        WHERE user_id = p_user_id
        AND role_type = p_role_type
        AND (p_tournament_id IS NULL OR tournament_id = p_tournament_id)
        AND (p_team_id IS NULL OR team_id = p_team_id)
        AND (p_match_id IS NULL OR match_id = p_match_id)
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create function to get all permissions for a user (for eager loading)
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    role_type TEXT,
    tournament_id UUID,
    team_id UUID,
    match_id UUID,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.user_id,
        up.role_type,
        up.tournament_id,
        up.team_id,
        up.match_id,
        up.created_at
    FROM user_permissions up
    WHERE up.user_id = p_user_id
    ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Add comments for documentation
COMMENT ON TABLE user_permissions IS 'Unified permission management table for system-wide, tournament, team, and match-level permissions';
COMMENT ON COLUMN user_permissions.role_type IS 'Type of role: admin (system-wide), tournament_admin, team_admin, or umpire';
COMMENT ON COLUMN user_permissions.tournament_id IS 'Tournament scope (NULL for admin or global permissions)';
COMMENT ON COLUMN user_permissions.team_id IS 'Team scope (NULL for non-team-specific permissions)';
COMMENT ON COLUMN user_permissions.match_id IS 'Match scope (NULL for non-match-specific permissions)';
COMMENT ON FUNCTION check_user_permission IS 'Checks if a user has a specific permission. Admin role returns true for all checks.';
COMMENT ON FUNCTION get_user_permissions IS 'Returns all permissions for a user (for eager loading)';

