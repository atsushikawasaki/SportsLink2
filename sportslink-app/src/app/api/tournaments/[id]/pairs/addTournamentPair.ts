import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/tournaments/:id/pairs - ペア追加（entry_id 経由でエントリーに紐づける）
export async function addTournamentPair(id: string, request: Request) {
    try {
        const body = await request.json();
        const { entry_id, pair_number, player_1_id, player_2_id } = body;

        if (!entry_id) {
            return NextResponse.json(
                { error: 'エントリーID（entry_id）は必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        if (!player_1_id) {
            return NextResponse.json(
                { error: '選手1は必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        if (player_2_id && player_1_id === player_2_id) {
            return NextResponse.json(
                { error: '同じ選手を選択することはできません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // entry_id がこの大会に属するか検証
        const { data: entry, error: entryError } = await supabase
            .from('tournament_entries')
            .select('id')
            .eq('id', entry_id)
            .eq('tournament_id', id)
            .maybeSingle();

        if (entryError || !entry) {
            return NextResponse.json(
                { error: '指定されたエントリーがこの大会に存在しません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const { data, error } = await supabase
            .from('tournament_pairs')
            .insert({
                entry_id,
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

