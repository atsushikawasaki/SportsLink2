import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/tournaments/:id/pairs - ペア追加（大会管理者または管理者）
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
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const [tournamentAdmin, admin] = await Promise.all([
            isTournamentAdmin(authUser.id, id),
            isAdmin(authUser.id),
        ]);
        if (!tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この大会にペアを追加する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

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

