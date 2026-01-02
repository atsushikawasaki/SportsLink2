import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/scoring/live - ライブ試合一覧取得
export async function getLiveMatches(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        const tournamentId = searchParams.get('tournament_id');

        const supabase = await createClient();

        let query = supabase
            .from('matches')
            .select(`
                *,
                match_scores(*),
                tournaments:tournament_id (
                    id,
                    name
                ),
                match_pairs(
                    *,
                    teams:team_id (
                        id,
                        name
                    )
                ),
                users!matches_umpire_id_fkey(id, display_name, email)
            `, { count: 'exact' })
            .in('status', ['inprogress', 'finished'])
            .order('started_at', { ascending: false, nullsFirst: false })
            .range(offset, offset + limit - 1);

        if (tournamentId) {
            query = query.eq('tournament_id', tournamentId);
        }

        const { data, error, count } = await query;

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data, count, limit, offset });
    } catch (error) {
        console.error('Get live matches error:', error);
        return NextResponse.json(
            { error: 'ライブ試合の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

