import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/scoring/matches/:matchId/start - 試合開始（審判または大会管理者または管理者）
export async function startMatch(matchId: string) {
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
            .select('tournament_id, status')
            .eq('id', matchId)
            .single();
        if (matchError || !matchMeta) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (matchMeta.status === 'inprogress') {
            return NextResponse.json(
                { error: 'この試合は既に進行中です', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        if (matchMeta.status === 'finished') {
            return NextResponse.json(
                { error: '終了済みの試合は開始できません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const tournamentId = matchMeta.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, matchId),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合を開始する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from('matches')
            .update({
                status: 'inprogress',
                started_at: new Date().toISOString(),
            })
            .eq('id', matchId)
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
        console.error('Start match error:', error);
        return NextResponse.json(
            { error: '試合の開始に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

