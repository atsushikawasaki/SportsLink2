import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/teams/:id/players - 選手追加
export async function addTeamPlayer(id: string, request: Request) {
    try {
        const body = await request.json();
        const { player_name, player_type } = body;

        if (!player_name || !player_type) {
            return NextResponse.json(
                { error: '選手名とポジションは必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // チーム情報を取得
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('tournament_id')
            .eq('id', id)
            .single();

        if (teamError || !team) {
            return NextResponse.json(
                { error: 'チームが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        // 選手を追加
        const { data, error } = await supabase
            .from('tournament_players')
            .insert({
                tournament_id: team.tournament_id,
                team_id: id,
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

