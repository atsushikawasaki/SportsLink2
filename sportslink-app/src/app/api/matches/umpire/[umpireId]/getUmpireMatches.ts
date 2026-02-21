import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/matches/umpire/:umpireId - 審判の担当試合一覧取得
export async function getUmpireMatches(umpireId: string, request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const tournamentId = searchParams.get('tournament_id');
        const search = searchParams.get('search');

        // Admin Clientを使用してRLSをバイパス（無限再帰エラーを回避）
        const adminClient = createAdminClient();

        let query = adminClient
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

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (tournamentId && tournamentId !== 'all') {
            query = query.eq('tournament_id', tournamentId);
        }

        if (search) {
            query = query.or(`round_name.ilike.%${search}%,tournaments.name.ilike.%${search}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Get umpire matches error:', error);
            // 無限再帰エラーの場合は詳細をログに記録
            if (error.code === '42P17') {
                console.error('RLS infinite recursion detected. Please apply migration 022 or use Admin Client.');
                console.error('Error details:', {
                    code: error.code,
                    message: error.message,
                    hint: error.hint,
                    details: error.details
                });
            }
            return NextResponse.json(
                { 
                    error: error.message || '担当試合一覧の取得に失敗しました', 
                    code: 'E-DB-001',
                    details: process.env.NODE_ENV === 'development' ? {
                        code: error.code,
                        hint: error.hint,
                        details: error.details,
                        message: error.message
                    } : undefined
                },
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

