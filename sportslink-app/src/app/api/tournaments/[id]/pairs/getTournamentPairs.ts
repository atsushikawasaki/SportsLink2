import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/pairs - ペア一覧取得
export async function getTournamentPairs(id: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournament_pairs')
            .select(`
                *,
                tournament_players!tournament_pairs_player_1_id_fkey (
                    id,
                    player_name,
                    player_type
                ),
                tournament_players!tournament_pairs_player_2_id_fkey (
                    id,
                    player_name,
                    player_type
                ),
                teams:team_id (
                    id,
                    name
                )
            `)
            .eq('tournament_id', id)
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: data || [] });
    } catch (error) {
        console.error('Get pairs error:', error);
        return NextResponse.json(
            { error: 'ペア一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

