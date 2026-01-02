import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/tournaments/:id/players - 選手追加
export async function addTournamentPlayer(id: string, request: Request) {
    try {
        const body = await request.json();
        const { team_id, player_name, player_type } = body;

        if (!team_id || !player_name || !player_type) {
            return NextResponse.json(
                { error: 'チームID、選手名、ポジションは必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournament_players')
            .insert({
                tournament_id: id,
                team_id,
                player_name,
                player_type,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Create player error:', error);
        return NextResponse.json(
            { error: '選手の追加に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

