import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/tournaments/:id/pairs/:pairId - ペア削除（大会管理者または管理者）
export async function deleteTournamentPair(id: string, pairId: string) {
    try {
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
                { error: 'この大会のペアを削除する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
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

        const { error } = await supabase
            .from('tournament_pairs')
            .delete()
            .eq('id', pairId);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'ペアを削除しました' });
    } catch (error) {
        console.error('Delete pair error:', error);
        return NextResponse.json(
            { error: 'ペアの削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

