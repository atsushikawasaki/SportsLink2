import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/teams - チーム一覧取得
export async function getTeams(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tournamentId = searchParams.get('tournament_id');
        const limitParam = searchParams.get('limit');
        const offsetParam = searchParams.get('offset');
        const limit = Math.max(1, Number.isNaN(parseInt(limitParam || '100', 10)) ? 100 : parseInt(limitParam || '100', 10));
        const offset = Math.max(0, Number.isNaN(parseInt(offsetParam || '0', 10)) ? 0 : parseInt(offsetParam || '0', 10));

        const supabase = await createClient();

        let teamIds: string[] | null = null;
        if (tournamentId) {
            const { data: entryRows } = await supabase
                .from('tournament_entries')
                .select('team_id')
                .eq('tournament_id', tournamentId)
                .not('team_id', 'is', null);
            teamIds = Array.from(new Set((entryRows || []).map((r) => r.team_id).filter(Boolean))) as string[];
        }

        let query = supabase
            .from('teams')
            .select(`
                *,
                tournament_players (
                    id,
                    player_name,
                    player_type
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (teamIds !== null) {
            if (teamIds.length === 0) {
                return NextResponse.json({ data: [], count: 0 });
            }
            query = query.in('id', teamIds);
        }

        const { data, error, count } = await query;

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: data || [],
            count: count || 0,
        });
    } catch (error) {
        console.error('Get teams error:', error);
        return NextResponse.json(
            { error: 'チーム一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

