import { isAdmin, isTeamAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/teams/:id - チーム削除（チーム管理者または管理者）
export async function deleteTeam(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const [teamAdmin, admin] = await Promise.all([
            isTeamAdmin(authUser.id, id),
            isAdmin(authUser.id),
        ]);
        if (!teamAdmin && !admin) {
            return NextResponse.json(
                { error: 'このチームを削除する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'チームを削除しました' });
    } catch (error) {
        console.error('Delete team error:', error);
        return NextResponse.json(
            { error: 'チームの削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

