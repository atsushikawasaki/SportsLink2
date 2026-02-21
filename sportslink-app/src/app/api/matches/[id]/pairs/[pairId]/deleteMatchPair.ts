import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/matches/:id/pairs/:pairId - ペア削除（審判または大会管理者または管理者）
export async function deleteMatchPair(id: string, pairId: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: matchMeta, error: matchError } = await supabase
            .from('matches')
            .select('tournament_id')
            .eq('id', id)
            .single();
        if (matchError || !matchMeta) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }
        const tournamentId = matchMeta.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, id),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合のペアを削除する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { error } = await supabase
            .from('match_pairs')
            .delete()
            .eq('id', pairId)
            .eq('match_id', id);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'ペアを削除しました' });
    } catch (error) {
        console.error('Delete match pair error:', error);
        return NextResponse.json(
            { error: 'ペアの削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

