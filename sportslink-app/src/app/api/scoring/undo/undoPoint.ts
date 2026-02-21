import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { updateMatchScoresFromPoints } from '@/lib/scoring/aggregateMatchScore';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/scoring/undo - Undo操作（審判または大会管理者または管理者）
export async function undoPoint(request: Request) {
    try {
        const body = await request.json();
        const { match_id } = body;

        if (!match_id) {
            return NextResponse.json(
                { error: '試合IDは必須です', code: 'E-VER-003' },
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

        const { data: matchMeta, error: matchError } = await supabase
            .from('matches')
            .select('id, tournament_id')
            .eq('id', match_id)
            .single();
        if (matchError || !matchMeta) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }
        const tournamentId = matchMeta.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, match_id),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合のポイントを取り消す権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        // Get the latest non-undone point
        const { data: latestPoint, error: fetchError } = await supabase
            .from('points')
            .select('*')
            .eq('match_id', match_id)
            .eq('is_undone', false)
            .order('server_received_at', { ascending: false })
            .limit(1)
            .single();

        if (fetchError || !latestPoint) {
            return NextResponse.json(
                { error: '取り消すポイントがありません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Mark point as undone
        const { error: updateError } = await supabase
            .from('points')
            .update({ is_undone: true })
            .eq('id', latestPoint.id);

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const scores = await updateMatchScoresFromPoints(supabase, match_id);

        const { data: matchRow } = await supabase
            .from('matches')
            .select('version')
            .eq('id', match_id)
            .single();

        if (matchRow && typeof matchRow.version === 'number') {
            await supabase
                .from('matches')
                .update({ version: matchRow.version + 1 })
                .eq('id', match_id);
        }

        return NextResponse.json({
            message: 'ポイントを取り消しました',
            undonePoint: latestPoint,
            match_scores: { game_count_a: scores.game_count_a, game_count_b: scores.game_count_b },
        });
    } catch (error) {
        console.error('Undo error:', error);
        return NextResponse.json(
            { error: 'Undo操作に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

