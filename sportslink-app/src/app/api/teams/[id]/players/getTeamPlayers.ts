import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/teams/:id/players - チームの選手一覧取得（actual_team_id で紐づく tournament_players）
export async function getTeamPlayers(id: string) {
    try {
        const supabase = await createClient();

        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('id, name')
            .eq('id', id)
            .single();

        if (teamError || !team) {
            return NextResponse.json(
                { error: 'チームが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const { data: players, error: playersError } = await supabase
            .from('tournament_players')
            .select('id, player_name, player_type, sort_order, entry_id, created_at')
            .eq('actual_team_id', id)
            .order('sort_order', { ascending: true, nullsFirst: true })
            .order('created_at', { ascending: true });

        if (playersError) {
            return NextResponse.json(
                { error: playersError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            team: { id: team.id, name: team.name },
            players: players ?? [],
        });
    } catch (error) {
        console.error('Get team players error:', error);
        return NextResponse.json(
            { error: '選手一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

