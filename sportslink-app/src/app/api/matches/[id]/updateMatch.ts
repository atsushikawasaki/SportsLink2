import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/matches/:id - 試合更新
export async function updateMatch(id: string, request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('matches')
            .update(body as never)
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
        console.error('Update match error:', error);
        return NextResponse.json(
            { error: '試合の更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

