import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/matches/:id/umpire - 審判の強制変更
export async function changeUmpire(id: string, request: Request) {
    try {
        const body = await request.json();
        const { umpire_id } = body;

        if (!umpire_id) {
            return NextResponse.json(
                { error: '審判IDは必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data, error } = await supabase
            .from('matches')
            .update({ umpire_id })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '審判を変更しました', data });
    } catch (error) {
        console.error('Change umpire error:', error);
        return NextResponse.json(
            { error: '審判の変更に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

