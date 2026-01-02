import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/tournaments/:id - 大会更新
export async function updateTournament(id: string, request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournaments')
            .update(body)
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
        console.error('Update tournament error:', error);
        return NextResponse.json(
            { error: '大会の更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

