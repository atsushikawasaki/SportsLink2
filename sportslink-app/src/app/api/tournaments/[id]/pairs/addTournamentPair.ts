import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/tournaments/:id/pairs - ペア追加
export async function addTournamentPair(id: string, request: Request) {
    try {
        const body = await request.json();
        const { team_id, pair_number, player_1_id, player_2_id } = body;

        if (!player_1_id) {
            return NextResponse.json(
                { error: '選手1は必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // シングルスの場合はplayer_2_idがnull、ダブルスの場合は必須
        if (player_2_id && player_1_id === player_2_id) {
            return NextResponse.json(
                { error: '同じ選手を選択することはできません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournament_pairs')
            .insert({
                tournament_id: id,
                team_id: team_id || null,
                pair_number: pair_number || null,
                player_1_id,
                player_2_id: player_2_id || null,
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
        console.error('Create pair error:', error);
        return NextResponse.json(
            { error: 'ペアの追加に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

