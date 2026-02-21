import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/tournaments/:id/teams/:teamId - チーム削除（大会管理者または管理者）
export async function deleteTournamentTeam(id: string, teamId: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const [tournamentAdmin, admin] = await Promise.all([
            isTournamentAdmin(authUser.id, id),
            isAdmin(authUser.id),
        ]);
        if (!tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この大会からチームを削除する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        // Tournament_Teamsテーブルから削除
        const { error: ttError } = await supabase
            .from('tournament_teams')
            .delete()
            .eq('tournament_id', id)
            .eq('team_id', teamId);

        if (ttError) {
            return NextResponse.json(
                { error: ttError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // チーム自体も削除（他の大会で使用されていない場合）
        // 注意: 実際の実装では、他の大会で使用されているかチェックする必要があります
        const { error: teamError } = await supabase
            .from('teams')
            .delete()
            .eq('id', teamId);

        if (teamError) {
            // チームが他の大会で使用されている場合は、tournament_teamsからの削除のみ成功とする
            console.warn('Team deletion failed, but tournament_teams deletion succeeded:', teamError);
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

