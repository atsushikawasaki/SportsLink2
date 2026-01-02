import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/matches/:id/pairs - ペア取得
export async function getMatchPairs(id: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('match_pairs')
            .select(`
                *,
                teams:team_id (
                    id,
                    name
                ),
                tournament_players!match_pairs_player_1_id_fkey (
                    id,
                    player_name,
                    player_type
                ),
                tournament_players!match_pairs_player_2_id_fkey (
                    id,
                    player_name,
                    player_type
                )
            `)
            .eq('match_id', id)
            .order('pair_number', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: data || [] });
    } catch (error) {
        console.error('Get match pairs error:', error);
        return NextResponse.json(
            { error: 'ペアの取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

