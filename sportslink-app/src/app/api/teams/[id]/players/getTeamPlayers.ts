import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/teams/:id/players - チームの選手一覧取得
export async function getTeamPlayers(id: string) {
    try {
        const supabase = await createClient();

        // チーム情報を取得
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('tournament_id')
            .eq('id', id)
            .single();

        if (teamError || !team) {
            return NextResponse.json(
                { error: 'チームが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        // 選手一覧を取得
        const { data: players, error: playersError } = await supabase
            .from('tournament_players')
            .select('*')
            .eq('team_id', id)
            .eq('tournament_id', team.tournament_id)
            .order('created_at', { ascending: true });

        if (playersError) {
            return NextResponse.json(
                { error: playersError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            team: { id, tournament_id: team.tournament_id },
            players: players || [],
        });
    } catch (error) {
        console.error('Get team players error:', error);
        return NextResponse.json(
            { error: '選手一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

