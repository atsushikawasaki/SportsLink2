import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/pairs - ペア一覧取得（tournament_entries 経由で pair_id に紐づく tournament_pairs）
export async function getTournamentPairs(id: string) {
    try {
        const supabase = await createClient();

        const { data: entries, error: entriesError } = await supabase
            .from('tournament_entries')
            .select('id, pair_id, team_id')
            .eq('tournament_id', id)
            .eq('is_active', true)
            .not('pair_id', 'is', null);

        if (entriesError) {
            return NextResponse.json(
                { error: entriesError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const pairIds = Array.from(new Set((entries ?? []).map((e) => e.pair_id).filter(Boolean))) as string[];
        const entryByPairId = new Map((entries ?? []).map((e) => [e.pair_id, e]));
        const teamIds = Array.from(new Set((entries ?? []).map((e) => e.team_id).filter(Boolean))) as string[];

        if (pairIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const { data: pairs, error: pairsError } = await supabase
            .from('tournament_pairs')
            .select(`
                id,
                entry_id,
                pair_number,
                player_1_id,
                player_2_id,
                created_at,
                player_1:tournament_players!tournament_pairs_player_1_id_fkey (
                    id,
                    player_name,
                    player_type
                ),
                player_2:tournament_players!tournament_pairs_player_2_id_fkey (
                    id,
                    player_name,
                    player_type
                )
            `)
            .in('id', pairIds)
            .order('created_at', { ascending: true });

        if (pairsError) {
            return NextResponse.json(
                { error: pairsError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        let teamsMap = new Map<string, { id: string; name: string }>();
        if (teamIds.length > 0) {
            const { data: teams } = await supabase
                .from('teams')
                .select('id, name')
                .in('id', teamIds);
            teamsMap = new Map((teams ?? []).map((t) => [t.id, t]));
        }

        const data = (pairs ?? []).map((pair) => {
            const entry = entryByPairId.get(pair.id);
            const team = entry?.team_id ? teamsMap.get(entry.team_id) : null;
            return {
                ...pair,
                teams: team ? { id: team.id, name: team.name } : null,
            };
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Get pairs error:', error);
        return NextResponse.json(
            { error: 'ペア一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
