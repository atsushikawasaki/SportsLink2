import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/matches/:id/pairs/:pairId - ペア更新
export async function updateMatchPair(id: string, pairId: string, request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('match_pairs')
            .update(body)
            .eq('id', pairId)
            .eq('match_id', id)
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
        console.error('Update match pair error:', error);
        return NextResponse.json(
            { error: 'ペアの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

