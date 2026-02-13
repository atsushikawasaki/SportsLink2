import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/entries - エントリー一覧取得
export async function getTournamentEntries(id: string) {
    try {
        const supabase = await createClient();

        // Tournament_Entriesを取得し、関連するTeams、Tournament_Pairs、Tournament_Playersも取得
        // まず基本的なエントリー情報を取得（外部キー参照の問題を回避するため、pair_idは後で処理）
        const { data: entries, error: entriesError } = await supabase
            .from('tournament_entries')
            .select(`
                *,
                teams:team_id (
                    id,
                    name
                )
            `)
            .eq('tournament_id', id)
            .order('created_at', { ascending: true });

        if (entriesError) {
            console.error('Get entries database error:', entriesError);
            return NextResponse.json(
                { 
                    error: entriesError.message, 
                    code: 'E-DB-001',
                    details: entriesError.details,
                    hint: entriesError.hint
                },
                { status: 500 }
            );
        }

        // pair_idが存在するエントリーに対して、tournament_pairsとtournament_playersの情報を取得
        const pairIds = entries
            ?.filter(entry => entry.pair_id)
            .map(entry => entry.pair_id)
            .filter((id): id is string => id !== null) || [];

        if (pairIds.length > 0) {
            const { data: pairs, error: pairsError } = await supabase
                .from('tournament_pairs')
                .select(`
                    id,
                    player_1_id,
                    player_2_id,
                    player_1:tournament_players!tournament_pairs_player_1_id_fkey (
                        id,
                        player_name
                    ),
                    player_2:tournament_players!tournament_pairs_player_2_id_fkey (
                        id,
                        player_name
                    )
                `)
                .in('id', pairIds);

            if (pairsError) {
                console.error('Get pairs error:', pairsError);
            } else if (pairs) {
                // ペア情報をエントリーに結合
                const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
                entries?.forEach(entry => {
                    if (entry.pair_id && pairsMap.has(entry.pair_id)) {
                        entry.tournament_pairs = pairsMap.get(entry.pair_id);
                    }
                });
            }
        }

        return NextResponse.json({ data: entries || [] });
    } catch (error) {
        console.error('Get entries error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        return NextResponse.json(
            { 
                error: 'エントリー一覧の取得に失敗しました', 
                code: 'E-SERVER-001',
                details: errorMessage,
                stack: errorStack
            },
            { status: 500 }
        );
    }
}

