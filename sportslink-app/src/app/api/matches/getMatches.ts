import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/matches - 試合一覧取得
export async function getMatches(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        const offset = parseInt(searchParams.get('offset') || '0');
        const tournamentId = searchParams.get('tournament_id');
        const status = searchParams.get('status');

        const supabase = await createClient();

        let query = supabase
            .from('matches')
            .select(`
                *,
                match_scores(*),
                match_pairs(
                    *,
                    teams(id, name)
                ),
                users!matches_umpire_id_fkey(id, display_name, email)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (tournamentId) {
            query = query.eq('tournament_id', tournamentId);
        }
        if (status) {
            query = query.eq('status', status);
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
        console.error('Get matches error:', error);
        return NextResponse.json(
            { error: '試合一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

