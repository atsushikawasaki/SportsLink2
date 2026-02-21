import { isTeamAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/entries/:entryId/token - 認証キー取得（大会管理者またはエントリ担当チームの管理者）
export async function getEntryToken(id: string, entryId: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: entry, error: entryError } = await supabase
            .from('tournament_entries')
            .select('id, tournament_id, team_id, day_token, is_checked_in')
            .eq('id', entryId)
            .eq('tournament_id', id)
            .single();

        if (entryError || !entry) {
            return NextResponse.json(
                { error: 'エントリーが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const [tournamentAdmin, teamAdmin] = await Promise.all([
            isTournamentAdmin(authUser.id, id),
            entry.team_id ? isTeamAdmin(authUser.id, entry.team_id) : Promise.resolve(false),
        ]);
        let isTeamManager = false;
        if (entry.team_id) {
            const { data: team } = await supabase
                .from('teams')
                .select('team_manager_user_id')
                .eq('id', entry.team_id)
                .single();
            isTeamManager = (team?.team_manager_user_id ?? null) === authUser.id;
        }
        if (!tournamentAdmin && !teamAdmin && !isTeamManager) {
            return NextResponse.json(
                { error: 'このエントリーの認証キーを取得する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            day_token: entry.day_token,
            is_checked_in: entry.is_checked_in,
        });
    } catch (error) {
        console.error('Get token error:', error);
        return NextResponse.json(
            { error: '認証キーの取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

