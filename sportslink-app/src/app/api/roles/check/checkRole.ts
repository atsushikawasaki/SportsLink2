import { NextResponse } from 'next/server';
import { checkPermission, RoleType } from '@/lib/permissions';

// POST /api/roles/check - 権限チェック
export async function checkRole(request: Request) {
    try {
        const body = await request.json();
        const { user_id, tournament_id, role, team_id, match_id } = body;

        if (!user_id || !role) {
            return NextResponse.json(
                { error: 'ユーザーIDとロールは必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Map old role names to new role types
        const roleTypeMap: Record<string, RoleType> = {
            'tournament_admin': 'tournament_admin',
            'scorer': 'umpire',
            'admin': 'admin',
            'team_admin': 'team_admin',
            'umpire': 'umpire',
        };

        const roleType = roleTypeMap[role] as RoleType;
        if (!roleType) {
            return NextResponse.json(
                { error: '有効なロールを指定してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Check permission using unified permission system
        // Only include scope fields if they are explicitly provided
        const scope: { tournament_id?: string | null; team_id?: string | null; match_id?: string | null } = {};
        if (tournament_id !== undefined) {
            scope.tournament_id = tournament_id || null;
        }
        if (team_id !== undefined) {
            scope.team_id = team_id || null;
        }
        if (match_id !== undefined) {
            scope.match_id = match_id || null;
        }

        const finalScope = Object.keys(scope).length > 0 ? scope : undefined;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('checkRole called:', { user_id, role, roleType, tournament_id, team_id, match_id, finalScope });
        }

        const hasPermission = await checkPermission(
            user_id,
            roleType,
            finalScope
        );

        if (process.env.NODE_ENV === 'development') {
            console.log('checkRole result:', { user_id, roleType, hasPermission });
        }

        return NextResponse.json({
            has_permission: hasPermission,
        });
    } catch (error) {
        console.error('Check role error:', error);
        return NextResponse.json(
            { error: '権限チェックに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

