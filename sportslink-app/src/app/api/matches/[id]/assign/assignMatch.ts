import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/matches/:id/assign - 試合割当（審判・コート）
export async function assignMatch(id: string, request: Request) {
    try {
        const body = await request.json();
        const { umpire_id, court_number } = body;

        const supabase = await createClient();

        const updateData: Record<string, unknown> = {};
        if (umpire_id !== undefined) updateData.umpire_id = umpire_id;
        if (court_number !== undefined) updateData.court_number = court_number;

        const { data, error } = await supabase
            .from('matches')
            .update(updateData as never)
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
        console.error('Assign match error:', error);
        return NextResponse.json(
            { error: '試合の割当に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

