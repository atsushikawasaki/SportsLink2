import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/tournaments/:id - 大会削除
export async function deleteTournament(id: string) {
    try {
        const supabase = await createClient();

        const { error } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '大会を削除しました' });
    } catch (error) {
        console.error('Delete tournament error:', error);
        return NextResponse.json(
            { error: '大会の削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

