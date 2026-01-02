import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/matches/:id/pairs/:pairId - ペア削除
export async function deleteMatchPair(id: string, pairId: string) {
    try {
        const supabase = await createClient();

        const { error } = await supabase
            .from('match_pairs')
            .delete()
            .eq('id', pairId)
            .eq('match_id', id);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'ペアを削除しました' });
    } catch (error) {
        console.error('Delete match pair error:', error);
        return NextResponse.json(
            { error: 'ペアの削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

