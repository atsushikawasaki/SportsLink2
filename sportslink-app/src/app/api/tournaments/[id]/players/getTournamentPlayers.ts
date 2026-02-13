import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/players - 大会の選手一覧取得（tournament_entries 経由で entry_id に紐づく tournament_players）
export async function getTournamentPlayers(id: string) {
    try {
        const supabase = await createClient();

        const { data: entries, error: entriesError } = await supabase
            .from('tournament_entries')
            .select('id')
            .eq('tournament_id', id)
            .eq('is_active', true);

        if (entriesError) {
            return NextResponse.json(
                { error: entriesError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const entryIds = (entries ?? []).map((e) => e.id);
        if (entryIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const { data: players, error: playersError } = await supabase
            .from('tournament_players')
            .select(`
                id,
                entry_id,
                actual_team_id,
                player_name,
                player_type,
                sort_order,
                created_at,
                teams:actual_team_id (
                    id,
                    name
                )
            `)
            .in('entry_id', entryIds)
            .order('entry_id')
            .order('sort_order', { ascending: true, nullsFirst: true })
            .order('created_at', { ascending: true });

        if (playersError) {
            return NextResponse.json(
                { error: playersError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: players ?? [] });
    } catch (error) {
        console.error('Get players error:', error);
        return NextResponse.json(
            { error: '選手一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
