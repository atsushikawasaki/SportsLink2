import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/tournaments/:id/finish - 大会終了
export async function finishTournament(id: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournaments')
            .update({ status: 'finished' })
            .eq('id', id)
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
        console.error('Finish tournament error:', error);
        return NextResponse.json(
            { error: '大会の終了に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

