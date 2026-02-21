import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/tournaments/:id/pairs/:pairId - ペア更新（大会管理者または管理者）
export async function updateTournamentPair(id: string, pairId: string, request: Request) {
    try {
        const body = await request.json();
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
                { error: 'この大会のペアを更新する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        if (body.player_1_id && body.player_2_id && body.player_1_id === body.player_2_id) {
            return NextResponse.json(
                { error: '同じ選手を選択することはできません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // ペアが指定大会に属するか entry_id → tournament_entries 経由で検証
        const { data: pair, error: pairError } = await supabase
            .from('tournament_pairs')
            .select('id, entry_id')
            .eq('id', pairId)
            .single();

        if (pairError || !pair) {
            return NextResponse.json(
                { error: 'ペアが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (pair.entry_id) {
            const { data: entry } = await supabase
                .from('tournament_entries')
                .select('id')
                .eq('id', pair.entry_id)
                .eq('tournament_id', id)
                .maybeSingle();

            if (!entry) {
                return NextResponse.json(
                    { error: 'このペアは指定された大会に属していません', code: 'E-FORBIDDEN' },
                    { status: 403 }
                );
            }
        }

        // 許可されたフィールドのみ更新
        const updateData: Record<string, unknown> = {};
        if (body.pair_number !== undefined) updateData.pair_number = body.pair_number;
        if (body.player_1_id !== undefined) updateData.player_1_id = body.player_1_id;
        if (body.player_2_id !== undefined) updateData.player_2_id = body.player_2_id;
        if (body.entry_id !== undefined) updateData.entry_id = body.entry_id;

        const { data, error } = await supabase
            .from('tournament_pairs')
            .update(updateData)
            .eq('id', pairId)
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
        console.error('Update pair error:', error);
        return NextResponse.json(
            { error: 'ペアの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

