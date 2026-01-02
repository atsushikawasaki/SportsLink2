import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/matches/:id/pairs - ペア提出
export async function submitMatchPairs(id: string, request: Request) {
    try {
        const body = await request.json();
        const { pairs } = body; // pairs: Array<{ pair_number, team_id, player_1_id, player_2_id? }>

        if (!Array.isArray(pairs) || pairs.length === 0) {
            return NextResponse.json(
                { error: 'ペア情報が必要です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // 既存のペアを削除
        const { error: deleteError } = await supabase
            .from('match_pairs')
            .delete()
            .eq('match_id', id);

        if (deleteError) {
            return NextResponse.json(
                { error: deleteError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // 新しいペアを追加
        const pairsToInsert = pairs.map((pair: any) => ({
            match_id: id,
            pair_number: pair.pair_number,
            team_id: pair.team_id,
            player_1_id: pair.player_1_id,
            player_2_id: pair.player_2_id || null,
        }));

        const { data, error: insertError } = await supabase
            .from('match_pairs')
            .insert(pairsToInsert)
            .select();

        if (insertError) {
            return NextResponse.json(
                { error: insertError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        console.error('Submit match pairs error:', error);
        return NextResponse.json(
            { error: 'ペアの提出に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

