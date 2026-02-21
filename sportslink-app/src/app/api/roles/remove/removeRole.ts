import { isAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { RoleType } from '@/lib/permissions';

// DELETE /api/roles/remove - 権限削除（admin のみ）
export async function removeRole(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }
        const hasAdmin = await isAdmin(authUser.id);
        if (!hasAdmin) {
            return NextResponse.json(
                { error: 'この操作には管理者権限が必要です', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const user_id = searchParams.get('user_id');
        const role = searchParams.get('role');
        const tournament_id = searchParams.get('tournament_id');
        const team_id = searchParams.get('team_id');
        const match_id = searchParams.get('match_id');

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

        let query = supabase
            .from('user_permissions')
            .delete()
            .eq('user_id', user_id)
            .eq('role_type', roleType);

        // Apply scope filters
        if (tournament_id) {
            query = query.eq('tournament_id', tournament_id);
        } else {
            query = query.is('tournament_id', null);
        }

        if (team_id) {
            query = query.eq('team_id', team_id);
        } else {
            query = query.is('team_id', null);
        }

        if (match_id) {
            query = query.eq('match_id', match_id);
        } else {
            query = query.is('match_id', null);
        }

        const { error } = await query;

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '権限を削除しました' });
    } catch (error) {
        console.error('Remove role error:', error);
        return NextResponse.json(
            { error: '権限の削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

