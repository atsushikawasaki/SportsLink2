import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/teams/players/:playerId - 選手更新
export async function updatePlayer(playerId: string, request: Request) {
    try {
        const body = await request.json();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournament_players')
            .update(body)
            .eq('id', playerId)
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
        console.error('Update player error:', error);
        return NextResponse.json(
            { error: '選手の更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

