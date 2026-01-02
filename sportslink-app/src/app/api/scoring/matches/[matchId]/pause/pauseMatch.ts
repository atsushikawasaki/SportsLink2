import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/scoring/matches/:matchId/pause - 試合中断
export async function pauseMatch(matchId: string) {
    try {
        const supabase = await createClient();

        // 試合ステータスを確認
        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('status')
            .eq('id', matchId)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (match.status !== 'inprogress') {
            return NextResponse.json(
                { error: '進行中の試合のみ中断できます', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // ステータスをpausedに変更
        const { data: updatedMatch, error: updateError } = await supabase
            .from('matches')
            .update({ status: 'paused' })
            .eq('id', matchId)
            .select()
            .single();

        if (updateError || !updatedMatch) {
            return NextResponse.json(
                { error: '試合の中断に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: '試合を中断しました',
            match_id: matchId,
            match: updatedMatch,
        });
    } catch (error) {
        console.error('Pause match error:', error);
        return NextResponse.json(
            { error: '試合の中断に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

