/**
 * Unified RBAC Permission Management
 * 
 * This module provides functions for checking user permissions
 * using the unified user_permissions table.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type RoleType = 'admin' | 'tournament_admin' | 'team_admin' | 'umpire';

export interface PermissionScope {
    tournament_id?: string | null;
    team_id?: string | null;
    match_id?: string | null;
}

export interface UserPermission {
    id: string;
    user_id: string;
    role_type: RoleType;
    tournament_id: string | null;
    team_id: string | null;
    match_id: string | null;
    created_at: string;
}

/**
 * Check if a user has a specific permission
 * 
 * @param userId - User ID to check
 * @param roleType - Type of role to check
 * @param scope - Optional scope (tournament_id, team_id, match_id)
 * @returns true if user has the permission, false otherwise
 * 
 * Note: Users with 'admin' role (all scope fields NULL) have all permissions
 */
export async function checkPermission(
    userId: string,
    roleType: RoleType,
    scope?: PermissionScope
): Promise<boolean> {
    // Use admin client to bypass RLS for permission checks
    // This is safe because we're only reading permission data, not modifying it
    const supabase = createAdminClient();

    // Debug logging (development only)
    if (process.env.NODE_ENV === 'development') {
        console.log('checkPermission called:', { userId, roleType, scope });
    }

    // First, check if user has admin role (admin has all permissions)
    const { data: adminPermission, error: adminError } = await supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', userId)
        .eq('role_type', 'admin')
        .is('tournament_id', null)
        .is('team_id', null)
        .is('match_id', null)
        .maybeSingle();

    if (adminError && adminError.code !== 'PGRST116') {
        console.error('Error checking admin permission:', adminError);
    }

    if (process.env.NODE_ENV === 'development') {
        console.log('Admin permission check:', { adminPermission, adminError });
    }

    if (adminPermission) {
        return true;
    }

    // Check specific permission
    // Build query with exact scope matching
    let query = supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', userId)
        .eq('role_type', roleType);

    // If no scope is provided, check for global permission (all scope fields NULL)
    // This is especially important for umpire role which can be global
    if (!scope || (scope.tournament_id === undefined && scope.team_id === undefined && scope.match_id === undefined)) {
        // Check for global permission (all scope fields NULL)
        query = query
            .is('tournament_id', null)
            .is('team_id', null)
            .is('match_id', null);
    } else {
        // Apply scope filters - exact match required
        if (scope.tournament_id !== undefined) {
            if (scope.tournament_id) {
                query = query.eq('tournament_id', scope.tournament_id);
            } else {
                query = query.is('tournament_id', null);
            }
        }

        if (scope.team_id !== undefined) {
            if (scope.team_id) {
                query = query.eq('team_id', scope.team_id);
            } else {
                query = query.is('team_id', null);
            }
        }

        if (scope.match_id !== undefined) {
            if (scope.match_id) {
                query = query.eq('match_id', scope.match_id);
            } else {
                query = query.is('match_id', null);
            }
        }
    }

    const { data: permission, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected
        console.error('Error checking permission:', error);
    }

    if (process.env.NODE_ENV === 'development') {
        console.log('Permission check result:', { permission, error, query: query.toString() });
    }

    if (permission) {
        return true;
    }

    // If no exact match found, check for broader permissions
    // 1. Check for global permission (all scope fields NULL) - applies to all scopes
    // This is especially important for umpire role
    if (scope && (scope.tournament_id || scope.team_id || scope.match_id)) {
        const { data: globalPermission } = await supabase
            .from('user_permissions')
            .select('id')
            .eq('user_id', userId)
            .eq('role_type', roleType)
            .is('tournament_id', null)
            .is('team_id', null)
            .is('match_id', null)
            .maybeSingle();
        
        if (globalPermission) {
            return true;
        }
    }

    // 2. For tournament-level checks, check if user has tournament-level permission
    if (scope && scope.tournament_id && !scope.team_id && !scope.match_id) {
        const { data: tournamentPermission } = await supabase
            .from('user_permissions')
            .select('id')
            .eq('user_id', userId)
            .eq('role_type', roleType)
            .eq('tournament_id', scope.tournament_id)
            .is('team_id', null)
            .is('match_id', null)
            .maybeSingle();
        
        if (tournamentPermission) {
            return true;
        }
    }

    return false;
}

/**
 * Get all permissions for a user (for eager loading)
 * 
 * @param userId - User ID
 * @returns Array of user permissions
 */
export async function getUserPermissions(userId: string): Promise<UserPermission[]> {
    // Use admin client to bypass RLS for permission queries
    const supabase = createAdminClient();

    const { data: permissions, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user permissions:', error);
        return [];
    }

    return (permissions || []) as UserPermission[];
}

/**
 * Check if user has admin role (system-wide admin)
 * 
 * @param userId - User ID to check
 * @returns true if user is admin, false otherwise
 */
export async function isAdmin(userId: string): Promise<boolean> {
    return checkPermission(userId, 'admin');
}

/**
 * Check if user has tournament admin role for a specific tournament
 * 
 * @param userId - User ID to check
 * @param tournamentId - Tournament ID
 * @returns true if user is tournament admin, false otherwise
 */
export async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
    return checkPermission(userId, 'tournament_admin', { tournament_id: tournamentId });
}

/**
 * Check if user has team admin role for a specific team
 * 
 * @param userId - User ID to check
 * @param teamId - Team ID
 * @returns true if user is team admin, false otherwise
 */
export async function isTeamAdmin(userId: string, teamId: string): Promise<boolean> {
    return checkPermission(userId, 'team_admin', { team_id: teamId });
}

/**
 * Check if user has umpire role (global or tournament-specific)
 * 
 * @param userId - User ID to check
 * @param tournamentId - Optional tournament ID for tournament-specific umpire
 * @returns true if user is umpire, false otherwise
 */
export async function isUmpire(userId: string, tournamentId?: string): Promise<boolean> {
    if (tournamentId) {
        return checkPermission(userId, 'umpire', { tournament_id: tournamentId });
    } else {
        // Check for global umpire permission
        return checkPermission(userId, 'umpire');
    }
}

/**
 * Get user with permissions (eager loading)
 * 
 * @param userId - User ID
 * @returns User object with permissions array
 */
export async function getUserWithPermissions(userId: string) {
    // Use admin client to bypass RLS for permission queries
    const supabase = createAdminClient();

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (userError || !user) {
        return null;
    }

    const permissions = await getUserPermissions(userId);

    return {
        ...user,
        permissions,
    };
}

