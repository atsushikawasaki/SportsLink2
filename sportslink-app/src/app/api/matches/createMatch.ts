import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/matches - 試合作成
export async function createMatch(request: Request) {
    try {
        const body = await request.json();
        const { tournament_id, round_name, umpire_id, court_number, phase_id } = body;

        if (!tournament_id || !round_name) {
            return NextResponse.json(
                { error: '大会IDとラウンド名は必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data, error } = await supabase
            .from('matches')
            .insert({
                tournament_id,
                round_name,
                umpire_id,
                court_number,
                phase_id,
                status: 'pending',
                version: 1,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // Create initial match_scores record
        await supabase.from('match_scores').insert({
            match_id: data.id,
            game_count_a: 0,
            game_count_b: 0,
        });

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Create match error:', error);
        return NextResponse.json(
            { error: '試合の作成に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

