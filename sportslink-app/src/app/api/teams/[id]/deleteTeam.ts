import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/teams/:id - チーム削除
export async function deleteTeam(id: string) {
    try {
        const supabase = await createClient();

        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'チームを削除しました' });
    } catch (error) {
        console.error('Delete team error:', error);
        return NextResponse.json(
            { error: 'チームの削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

