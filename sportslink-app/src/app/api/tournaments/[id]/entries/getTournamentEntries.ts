import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/entries - エントリー一覧取得（大会管理者または管理者）
export async function getTournamentEntries(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const [tournamentAdmin, admin] = await Promise.all([
            isTournamentAdmin(authUser.id, id),
            isAdmin(authUser.id),
        ]);
        if (!tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この大会のエントリーを閲覧する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

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
            .eq('is_active', true)
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

