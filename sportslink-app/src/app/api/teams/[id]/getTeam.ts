import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/teams/:id - チーム詳細取得（actual_team_id で紐づく選手を別取得）
export async function getTeam(id: string) {
    try {
        const supabase = await createClient();

        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('id, name, team_manager_user_id, created_at')
            .eq('id', id)
            .single();

        if (teamError || !team) {
            return NextResponse.json(
                { error: 'チームが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const { data: players } = await supabase
            .from('tournament_players')
            .select('id, player_name, player_type, sort_order, created_at')
            .eq('actual_team_id', id)
            .order('sort_order', { ascending: true, nullsFirst: true })
            .order('created_at', { ascending: true });

        return NextResponse.json({
            ...team,
            tournament_players: players ?? [],
        });
    } catch (error) {
        console.error('Get team error:', error);
        return NextResponse.json(
            { error: 'チームの取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

