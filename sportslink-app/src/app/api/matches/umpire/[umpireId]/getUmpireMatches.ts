import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/matches/umpire/:umpireId - 審判の担当試合一覧取得
export async function getUmpireMatches(umpireId: string, request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
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
                )
            `)
            .eq('umpire_id', umpireId)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (tournamentId) {
            query = query.eq('tournament_id', tournamentId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Get umpire matches error:', error);
            return NextResponse.json(
                { error: '担当試合一覧の取得に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: data || [],
            count: data?.length || 0,
        });
    } catch (error) {
        console.error('Get umpire matches error:', error);
        return NextResponse.json(
            { error: '担当試合一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

