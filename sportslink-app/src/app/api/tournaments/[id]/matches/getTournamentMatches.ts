import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/matches - 大会の試合一覧取得
export async function getTournamentMatches(id: string, request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const supabase = await createClient();

        let query = supabase
            .from('matches')
            .select(`
                *,
                match_scores(*),
                match_pairs(
                    *,
                    teams:team_id (
                        id,
                        name
                    )
                ),
                users:umpire_id (
                    id,
                    display_name,
                    email
                )
            `)
            .eq('tournament_id', id)
            .order('round_index', { ascending: true })
            .order('slot_index', { ascending: true })
            .order('match_number', { ascending: true });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Get tournament matches error:', error);
            return NextResponse.json(
                { error: '試合一覧の取得に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: data || [],
            count: data?.length || 0,
        });
    } catch (error) {
        console.error('Get tournament matches error:', error);
        return NextResponse.json(
            { error: '試合一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

