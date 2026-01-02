import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/matches/:id/score - 試合スコア取得
export async function getMatchScoreById(id: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('match_scores')
            .select('*')
            .eq('match_id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // スコアが存在しない場合はデフォルト値を返す
                return NextResponse.json({
                    match_id: id,
                    game_count_a: 0,
                    game_count_b: 0,
                    final_score: null,
                });
            }
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Get match score error:', error);
        return NextResponse.json(
            { error: '試合スコアの取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

