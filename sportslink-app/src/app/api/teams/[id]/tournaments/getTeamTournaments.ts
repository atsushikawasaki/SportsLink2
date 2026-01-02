import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/teams/:id/tournaments - チームの参加大会一覧取得
export async function getTeamTournaments(id: string) {
    try {
        const supabase = await createClient();

        // Tournament_Teamsテーブルから大会IDを取得
        const { data: tournamentTeams, error: ttError } = await supabase
            .from('tournament_teams')
            .select('tournament_id')
            .eq('team_id', id);

        if (ttError) {
            return NextResponse.json(
                { error: ttError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const tournamentIds = tournamentTeams?.map((tt) => tt.tournament_id) || [];

        if (tournamentIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // 大会情報を取得
        const { data: tournaments, error: tournamentsError } = await supabase
            .from('tournaments')
            .select('*')
            .in('id', tournamentIds)
            .order('created_at', { ascending: false });

        if (tournamentsError) {
            return NextResponse.json(
                { error: tournamentsError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: tournaments || [] });
    } catch (error) {
        console.error('Get team tournaments error:', error);
        return NextResponse.json(
            { error: '参加大会一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

