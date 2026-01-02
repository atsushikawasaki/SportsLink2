import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/scoring/matches/:matchId/score - 試合スコア取得
export async function getMatchScore(matchId: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('match_scores')
            .select('*')
            .eq('match_id', matchId)
            .single();

        if (error) {
            return NextResponse.json(
                { error: 'スコアが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Get score error:', error);
        return NextResponse.json(
            { error: 'スコアの取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

