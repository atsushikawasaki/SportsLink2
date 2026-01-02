import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/scoring/undo - Undo操作
export async function undoPoint(request: Request) {
    try {
        const body = await request.json();
        const { match_id } = body;

        if (!match_id) {
            return NextResponse.json(
                { error: '試合IDは必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Get the latest non-undone point
        const { data: latestPoint, error: fetchError } = await supabase
            .from('points')
            .select('*')
            .eq('match_id', match_id)
            .eq('is_undone', false)
            .order('server_received_at', { ascending: false })
            .limit(1)
            .single();

        if (fetchError || !latestPoint) {
            return NextResponse.json(
                { error: '取り消すポイントがありません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Mark point as undone
        const { error: updateError } = await supabase
            .from('points')
            .update({ is_undone: true })
            .eq('id', latestPoint.id);

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // Increment version
        const { data: match } = await supabase
            .from('matches')
            .select('version')
            .eq('id', match_id)
            .single();

        if (match) {
            await supabase
                .from('matches')
                .update({ version: match.version + 1 })
                .eq('id', match_id);
        }

        return NextResponse.json({ message: 'ポイントを取り消しました', undonePoint: latestPoint });
    } catch (error) {
        console.error('Undo error:', error);
        return NextResponse.json(
            { error: 'Undo操作に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

