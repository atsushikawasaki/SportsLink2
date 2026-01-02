import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/scoring/matches/:matchId/start - 試合開始
export async function startMatch(matchId: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('matches')
            .update({
                status: 'inprogress',
                started_at: new Date().toISOString(),
            })
            .eq('id', matchId)
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
        console.error('Start match error:', error);
        return NextResponse.json(
            { error: '試合の開始に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

