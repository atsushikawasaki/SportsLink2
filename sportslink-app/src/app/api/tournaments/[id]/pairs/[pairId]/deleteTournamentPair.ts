import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/tournaments/:id/pairs/:pairId - ペア削除（entry_id 経由で大会所属を検証）
export async function deleteTournamentPair(id: string, pairId: string) {
    try {
        const supabase = await createClient();

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

        const { error } = await supabase
            .from('tournament_pairs')
            .delete()
            .eq('id', pairId);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'ペアを削除しました' });
    } catch (error) {
        console.error('Delete pair error:', error);
        return NextResponse.json(
            { error: 'ペアの削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

