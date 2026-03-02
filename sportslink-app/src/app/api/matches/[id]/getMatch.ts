import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { NextResponse } from 'next/server';

// GET /api/matches/:id - 試合詳細取得
export async function getMatch(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: '認証が必要です', code: 'E-AUTH-001' }, { status: 401 });
        }

        const adminClient = createAdminClient();

        // 試合を取得（まず tournament_id を得るため admin で取得）
        const { data: matchRow, error: fetchError } = await adminClient
            .from('matches')
            .select('id, tournament_id, umpire_id')
            .eq('id', id)
            .single();

        if (fetchError || !matchRow?.tournament_id) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const canAccess =
            await isAdmin(user.id) ||
            await isTournamentAdmin(user.id, matchRow.tournament_id) ||
            (await adminClient.from('tournaments').select('created_by_user_id').eq('id', matchRow.tournament_id).single()).data?.created_by_user_id === user.id ||
            matchRow.umpire_id === user.id;

        const client = canAccess ? adminClient : supabase;

        // Get match with all related data in a single query
        const { data: matchData, error: matchError } = await client
            .from('matches')
            .select(`
                *,
                match_scores(*),
                match_pairs(
                    *,
                    teams:team_id (
                        id,
                        name,
                        team_manager_user_id
                    ),
                    tournament_players!match_pairs_player_1_id_fkey (
                        id,
                        player_name,
                        player_type
                    ),
                    tournament_players!match_pairs_player_2_id_fkey (
                        id,
                        player_name,
                        player_type
                    )
                ),
                users!matches_umpire_id_fkey (
                    id,
                    display_name,
                    email
                ),
                tournaments:tournament_id (
                    id,
                    name,
                    umpire_mode
                )
            `)
            .eq('id', id)
            .single();

        if (matchError || !matchData) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        // If this is a team match (parent), get child matches
        let childMatches = null;
        if (matchData.match_type === 'team_match') {
            const { data: children } = await client
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
                    )
                `)
                .eq('parent_match_id', id)
                .order('created_at', { ascending: true });
            
            childMatches = children || [];
        }

        // Sort match_pairs by pair_number
        const sortedPairs = (matchData.match_pairs || []).sort(
            (a: { pair_number?: number }, b: { pair_number?: number }) => (a.pair_number || 0) - (b.pair_number || 0)
        );

        const scores = matchData.match_scores;
        const matchScoresArray = Array.isArray(scores) ? scores : scores ? [scores] : [];

        const data = {
            ...matchData,
            match_scores: matchScoresArray,
            match_pairs: sortedPairs,
            users: matchData.users || null,
            tournaments: matchData.tournaments || null,
            child_matches: childMatches,
        };

        return NextResponse.json(data);
    } catch (error) {
        console.error('Get match error:', error);
        return NextResponse.json(
            { error: '試合の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

