import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/teams - チーム一覧取得
export async function getTeams(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const tournamentId = searchParams.get('tournament_id');
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        const supabase = await createClient();
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

