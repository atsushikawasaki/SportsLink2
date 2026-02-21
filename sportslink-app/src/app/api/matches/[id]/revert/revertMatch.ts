import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/matches/:id/revert - 試合差し戻し（審判または大会管理者または管理者）
export async function revertMatch(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: match, error: fetchError } = await supabase
            .from('matches')
            .select('id, status, tournament_id, next_match_id, winner_source_match_a, winner_source_match_b')
            .eq('id', id)
            .single();

        if (fetchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const tournamentId = match.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, id),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合を差し戻す権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        if (match.status !== 'finished') {
            return NextResponse.json(
                { error: '終了した試合のみ差し戻しできます', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const nextMatchId = match.next_match_id as string | null;
        const winnerSourceA = match.winner_source_match_a as string | null;
        const winnerSourceB = match.winner_source_match_b as string | null;

        if (nextMatchId) {
            let slotNumber: number | null = null;
            if (winnerSourceA === id) slotNumber = 1;
            else if (winnerSourceB === id) slotNumber = 2;
            else {
                const { data: me } = await supabase
                    .from('matches')
                    .select('slot_index')
                    .eq('id', id)
                    .single();
                slotNumber = me?.slot_index != null && me.slot_index % 2 === 0 ? 1 : 2;
            }
            if (slotNumber != null) {
                const { data: pair } = await supabase
                    .from('match_pairs')
                    .select('id')
                    .eq('match_id', nextMatchId)
                    .eq('pair_number', slotNumber)
                    .maybeSingle();
                if (pair?.id) {
                    await supabase.from('match_pairs').delete().eq('id', (pair as { id: string }).id);
                }
            }
        }

        await supabase
            .from('match_scores')
            .update({
                winner_id: null,
                ended_at: null,
                winning_reason: null,
            })
            .eq('match_id', id);

        const { data, error } = await supabase
            .from('matches')
            .update({ status: 'inprogress' } as never)
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
        console.error('Revert match error:', error);
        return NextResponse.json(
            { error: '試合の差し戻しに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

