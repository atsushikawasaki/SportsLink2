import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/scoring/matches/:matchId/resume - 試合再開（審判または大会管理者または管理者）
export async function resumeMatch(matchId: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('status, tournament_id')
            .eq('id', matchId)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }
        const tournamentId = match.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, matchId),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合を再開する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        if (match.status !== 'paused') {
            return NextResponse.json(
                { error: '中断中の試合のみ再開できます', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // ステータスをinprogressに戻す
        const { data: updatedMatch, error: updateError } = await supabase
            .from('matches')
            .update({ status: 'inprogress' })
            .eq('id', matchId)
            .select()
            .single();

        if (updateError || !updatedMatch) {
            return NextResponse.json(
                { error: '試合の再開に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: '試合を再開しました',
            match_id: matchId,
            match: updatedMatch,
        });
    } catch (error) {
        console.error('Resume match error:', error);
        return NextResponse.json(
            { error: '試合の再開に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

