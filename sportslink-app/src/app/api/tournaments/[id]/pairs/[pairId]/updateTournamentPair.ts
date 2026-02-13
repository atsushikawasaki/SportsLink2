import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/tournaments/:id/pairs/:pairId - ペア更新（entry_id 経由で大会所属を検証）
export async function updateTournamentPair(id: string, pairId: string, request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        if (body.player_1_id && body.player_2_id && body.player_1_id === body.player_2_id) {
            return NextResponse.json(
                { error: '同じ選手を選択することはできません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // ペアが指定大会に属するか entry_id → tournament_entries 経由で検証
        const { data: pair, error: pairError } = await supabase
            .from('tournament_pairs')
            .select('id, entry_id')
            .eq('id', pairId)
            .single();

        if (pairError || !pair) {
            return NextResponse.json(
                { error: 'ペアが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (pair.entry_id) {
            const { data: entry } = await supabase
                .from('tournament_entries')
                .select('id')
                .eq('id', pair.entry_id)
                .eq('tournament_id', id)
                .maybeSingle();

            if (!entry) {
                return NextResponse.json(
                    { error: 'このペアは指定された大会に属していません', code: 'E-FORBIDDEN' },
                    { status: 403 }
                );
            }
        }

        // 許可されたフィールドのみ更新
        const updateData: Record<string, unknown> = {};
        if (body.pair_number !== undefined) updateData.pair_number = body.pair_number;
        if (body.player_1_id !== undefined) updateData.player_1_id = body.player_1_id;
        if (body.player_2_id !== undefined) updateData.player_2_id = body.player_2_id;
        if (body.entry_id !== undefined) updateData.entry_id = body.entry_id;

        const { data, error } = await supabase
            .from('tournament_pairs')
            .update(updateData)
            .eq('id', pairId)
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

