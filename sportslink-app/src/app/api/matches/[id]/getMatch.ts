import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/matches/:id - 試合詳細取得
export async function getMatch(id: string) {
    try {
        const supabase = await createClient();

        // Get match with related data
        const { data: matchData, error: matchError } = await supabase
            .from('matches')
            .select(`
                *,
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

        // Get match_scores
        const { data: scores } = await supabase
            .from('match_scores')
            .select('*')
            .eq('match_id', id)
            .single();

        // Get match_pairs with teams and players
        const { data: pairs } = await supabase
            .from('match_pairs')
            .select(`
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
            `)
            .eq('match_id', id)
            .order('pair_number', { ascending: true });

        // Get umpire info
        let umpire = null;
        if (matchData.umpire_id) {
            const { data: umpireData } = await supabase
                .from('users')
                .select('id, display_name, email')
                .eq('id', matchData.umpire_id)
                .single();
            umpire = umpireData;
        }

        // If this is a team match (parent), get child matches
        let childMatches = null;
        if (matchData.match_type === 'team_match') {
            const { data: children } = await supabase
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

        const data = {
            ...matchData,
            match_scores: scores ? [scores] : [],
            match_pairs: pairs || [],
            users: umpire,
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

