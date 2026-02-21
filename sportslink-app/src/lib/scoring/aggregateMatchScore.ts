import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * points テーブルから is_undone = false のポイントを集計し、
 * game_count_a / game_count_b を返す。
 */
export async function aggregateGameCountsFromPoints(
    supabase: SupabaseClient,
    matchId: string
): Promise<{ game_count_a: number; game_count_b: number }> {
    const { data: points, error } = await supabase
        .from('points')
        .select('point_type')
        .eq('match_id', matchId)
        .eq('is_undone', false);

    if (error) {
        throw new Error(`Failed to fetch points: ${error.message}`);
    }

    let game_count_a = 0;
    let game_count_b = 0;
    for (const p of points ?? []) {
        if (p.point_type === 'A_score') game_count_a += 1;
        else if (p.point_type === 'B_score') game_count_b += 1;
    }
    return { game_count_a, game_count_b };
}

/**
 * points から集計し、match_scores を upsert する。
 * addPoint / undoPoint から呼び出し、C1/H1 対応。
 */
export async function updateMatchScoresFromPoints(
    supabase: SupabaseClient,
    matchId: string
): Promise<{ game_count_a: number; game_count_b: number }> {
    const counts = await aggregateGameCountsFromPoints(supabase, matchId);

    const { error } = await supabase
        .from('match_scores')
        .upsert(
            {
                match_id: matchId,
                game_count_a: counts.game_count_a,
                game_count_b: counts.game_count_b,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'match_id' }
        );

    if (error) {
        throw new Error(`Failed to update match_scores: ${error.message}`);
    }

    return counts;
}
