import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { processMatchFinish } from '@/lib/services/matchFlowService';

// PUT /api/matches/:id/status - 試合ステータス更新
export async function updateMatchStatus(id: string, request: Request) {
    try {
        const body = await request.json();
        const { status } = body;

        if (!status || !['pending', 'inprogress', 'paused', 'finished'].includes(status)) {
            return NextResponse.json(
                { error: '有効なステータスを指定してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const updateData: any = { status };
        if (status === 'inprogress' && !body.started_at) {
            updateData.started_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('matches')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // If status is 'finished', process match finish with automatic updates
        if (status === 'finished') {
            try {
                await processMatchFinish(id);
            } catch (flowError) {
                console.error('Match flow processing error:', flowError);
                // Continue even if flow processing fails - match is already marked as finished
            }
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Update match status error:', error);
        return NextResponse.json(
            { error: '試合ステータスの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

