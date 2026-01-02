import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/tournaments/:id/pairs/:pairId - ペア更新
export async function updateTournamentPair(id: string, pairId: string, request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        // player_1_idとplayer_2_idが同じでないことを確認
        if (body.player_1_id && body.player_2_id && body.player_1_id === body.player_2_id) {
            return NextResponse.json(
                { error: '同じ選手を選択することはできません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('tournament_pairs')
            .update(body)
            .eq('id', pairId)
            .eq('tournament_id', id)
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
        console.error('Update pair error:', error);
        return NextResponse.json(
            { error: 'ペアの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

