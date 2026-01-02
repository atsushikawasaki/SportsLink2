import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/teams/players/:playerId - 選手削除
export async function deletePlayer(playerId: string) {
    try {
        const supabase = await createClient();

        const { error } = await supabase
            .from('tournament_players')
            .delete()
            .eq('id', playerId);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '選手を削除しました' });
    } catch (error) {
        console.error('Delete player error:', error);
        return NextResponse.json(
            { error: '選手の削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

