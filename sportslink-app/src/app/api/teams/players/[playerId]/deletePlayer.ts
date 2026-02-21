import { isAdmin, isTeamAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/teams/players/:playerId - 選手削除（チーム管理者または管理者）
export async function deletePlayer(playerId: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: player, error: playerError } = await supabase
            .from('tournament_players')
            .select('actual_team_id')
            .eq('id', playerId)
            .single();
        if (playerError || !player) {
            return NextResponse.json(
                { error: '選手が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }
        const teamId = player.actual_team_id as string;
        const [teamAdmin, admin] = await Promise.all([
            isTeamAdmin(authUser.id, teamId),
            isAdmin(authUser.id),
        ]);
        if (!teamAdmin && !admin) {
            return NextResponse.json(
                { error: 'この選手を削除する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { error } = await supabase
            .from('tournament_players')
            .delete()
            .eq('id', playerId);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '選手を削除しました' });
    } catch (error) {
        console.error('Delete player error:', error);
        return NextResponse.json(
            { error: '選手の削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

