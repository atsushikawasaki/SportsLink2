import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/matches/:id - 試合削除
export async function deleteMatch(id: string) {
    try {
        const supabase = await createClient();

        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '試合を削除しました' });
    } catch (error) {
        console.error('Delete match error:', error);
        return NextResponse.json(
            { error: '試合の削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

