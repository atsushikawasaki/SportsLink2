import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/teams/:id - チーム更新
export async function updateTeam(id: string, request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('teams')
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
        console.error('Update team error:', error);
        return NextResponse.json(
            { error: 'チームの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

