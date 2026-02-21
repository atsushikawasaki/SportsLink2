import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/matches - 大会の試合一覧取得（match_pairs RLS 再帰を避けるため admin 使用）
export async function getTournamentMatches(id: string, request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const roundFilter = searchParams.get('round');

        const supabase = createAdminClient();

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

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (roundFilter && roundFilter !== 'all') {
            query = query.eq('round_name', roundFilter);
        }

        if (search) {
            query = query.or(`round_name.ilike.%${search}%`);
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

