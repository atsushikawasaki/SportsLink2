import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/matches/:id/revert - 試合差し戻し（finished → inprogress）
export async function revertMatch(id: string) {
    try {
        const supabase = await createClient();

        // Check if match is finished
        const { data: match, error: fetchError } = await supabase
            .from('matches')
            .select('status')
            .eq('id', id)
            .single();

        if (fetchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (match.status !== 'finished') {
            return NextResponse.json(
                { error: '終了した試合のみ差し戻しできます', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('matches')
            .update({ status: 'inprogress' } as never)
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
        console.error('Revert match error:', error);
        return NextResponse.json(
            { error: '試合の差し戻しに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

