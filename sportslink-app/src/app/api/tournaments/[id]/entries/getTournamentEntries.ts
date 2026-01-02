import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/entries - エントリー一覧取得
export async function getTournamentEntries(id: string) {
    try {
        const supabase = await createClient();

        // Tournament_Entriesを取得し、関連するTeams、Tournament_Pairs、Tournament_Playersも取得
        const { data: entries, error: entriesError } = await supabase
            .from('tournament_entries')
            .select(`
                *,
                teams:team_id (
                    id,
                    name
                ),
                tournament_pairs:pair_id (
                    id,
                    player_1_id,
                    player_2_id,
                    tournament_players!tournament_pairs_player_1_id_fkey (
                        id,
                        player_name
                    ),
                    tournament_players!tournament_pairs_player_2_id_fkey (
                        id,
                        player_name
                    )
                )
            `)
            .eq('tournament_id', id)
            .order('created_at', { ascending: true });

        if (entriesError) {
            return NextResponse.json(
                { error: entriesError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: entries || [] });
    } catch (error) {
        console.error('Get entries error:', error);
        return NextResponse.json(
            { error: 'エントリー一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

