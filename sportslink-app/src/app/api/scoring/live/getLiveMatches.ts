import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/scoring/live - ライブ試合一覧取得（match_pairs RLS 再帰を避けるため admin 使用）
export async function getLiveMatches(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const offsetParam = searchParams.get('offset');
        const limit = Math.max(1, Number.isNaN(parseInt(limitParam || '20', 10)) ? 20 : parseInt(limitParam || '20', 10));
        const offset = Math.max(0, Number.isNaN(parseInt(offsetParam || '0', 10)) ? 0 : parseInt(offsetParam || '0', 10));
        const tournamentId = searchParams.get('tournament_id');

        const supabase = createAdminClient();

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
            console.error('Get live matches error:', error);
            // 無限再帰エラーの場合は詳細をログに記録
            if (error.code === '42P17') {
                console.error('RLS infinite recursion detected. Please apply migration 022 or use Admin Client.');
            }
            return NextResponse.json(
                { 
                    error: error.message, 
                    code: 'E-DB-001',
                    details: process.env.NODE_ENV === 'development' ? {
                        code: error.code,
                        hint: error.hint,
                        details: error.details
                    } : undefined
                },
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

