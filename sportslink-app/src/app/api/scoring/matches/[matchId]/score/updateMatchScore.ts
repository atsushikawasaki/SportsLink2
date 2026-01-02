import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/scoring/matches/:matchId/score - スコアの直接修正（管理者用）
export async function updateMatchScore(matchId: string, request: Request) {
    try {
        const body = await request.json();
        const { game_count_a, game_count_b, final_score } = body;

        const supabase = await createClient();

        const { data, error } = await supabase
            .from('match_scores')
            .upsert({
                match_id: matchId,
                game_count_a,
                game_count_b,
                final_score,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Update score error:', error);
        return NextResponse.json(
            { error: 'スコアの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

