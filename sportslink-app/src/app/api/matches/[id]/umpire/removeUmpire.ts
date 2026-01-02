import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/matches/:id/umpire - 審判権限の強制解除
export async function removeUmpire(id: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('matches')
            .update({ umpire_id: null })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '審判権限を解除しました', data });
    } catch (error) {
        console.error('Remove umpire error:', error);
        return NextResponse.json(
            { error: '審判権限の解除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

