import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/tournaments/:id/teams/:teamId - チーム削除
export async function deleteTournamentTeam(id: string, teamId: string) {
    try {
        const supabase = await createClient();

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

