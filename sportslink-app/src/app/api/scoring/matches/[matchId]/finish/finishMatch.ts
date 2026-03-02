import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { processMatchFinish } from '@/lib/services/matchFlowService';

// POST /api/scoring/matches/:matchId/finish - 試合終了（審判または大会管理者または管理者）
export async function finishMatch(matchId: string, request?: Request) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        let matchVersion: number | undefined;
        if (request) {
            try {
                const body = await request.json();
                if (typeof body?.matchVersion === 'number') matchVersion = body.matchVersion;
            } catch {
                return NextResponse.json(
                    { error: 'リクエストボディが不正なJSONです', code: 'E-VER-003' },
                    { status: 400 }
                );
            }
        }

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select(`
                *,
                tournaments:tournament_id (
                    id,
                    umpire_mode
                ),
                match_scores(*),
                match_pairs(
                    *,
                    teams:team_id (
                        id
                    )
                )
            `)
            .eq('id', matchId)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (matchVersion !== undefined && (match as { version?: number }).version !== matchVersion) {
            return NextResponse.json(
                { error: 'データが競合しています。再同期してください', code: 'E-CONFL-001' },
                { status: 409 }
            );
        }

        const tournamentId = (match as { tournament_id?: string }).tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, matchId),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合を終了する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        try {
            await processMatchFinish(matchId);
        } catch (finishError: unknown) {
            if ((finishError as { code?: string })?.code === 'NO_WINNER') {
                return NextResponse.json(
                    { error: 'スコアが同点のため、勝者を決定できません。スコアを確認してください。', code: 'E-VER-003' },
                    { status: 400 }
                );
            }
            throw finishError;
        }

        const { data: updatedMatch, error: updateError } = await supabase
            .from('matches')
            .update({ status: 'finished' })
            .eq('id', matchId)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const tournament = match.tournaments as { id: string; umpire_mode: string } | null;
        if (tournament?.umpire_mode === 'LOSER' && match.match_scores && match.match_scores.length > 0) {
            const score = match.match_scores[0];
            const scoreA = score.game_count_a || 0;
            const scoreB = score.game_count_b || 0;
            const loserPair =
                scoreA < scoreB
                    ? match.match_pairs?.[0]
                    : scoreB < scoreA
                      ? match.match_pairs?.[1]
                      : null;

            if (loserPair && match.next_match_id) {
                // 敗者のエントリーからteam_idを取得
                const { data: loserEntry } = await supabase
                    .from('tournament_entries')
                    .select('team_id, day_token')
                    .eq('team_id', loserPair.teams?.id)
                    .eq('tournament_id', tournament.id)
                    .eq('is_checked_in', true)
                    .single();

                if (loserEntry?.team_id) {
                    // 敗者チームのteam_manager_user_idを取得
                    const { data: team } = await supabase
                        .from('teams')
                        .select('team_manager_user_id')
                        .eq('id', loserEntry.team_id)
                        .single();

                    if (team?.team_manager_user_id) {
                        const { createAdminClient } = await import('@/lib/supabase/admin');
                        const adminSupabase = createAdminClient();

                        // 次試合の情報を取得
                        const { data: nextMatch } = await supabase
                            .from('matches')
                            .select('id, tournament_id')
                            .eq('id', match.next_match_id)
                            .single();

                        if (nextMatch) {
                            // 既存の審判権限を確認（tournament_idのみ、match_idはNULL）
                            const { data: existingPermission } = await adminSupabase
                                .from('user_permissions')
                                .select('id')
                                .eq('user_id', team.team_manager_user_id)
                                .eq('role_type', 'umpire')
                                .eq('tournament_id', nextMatch.tournament_id)
                                .is('match_id', null)
                                .maybeSingle();

                            if (existingPermission) {
                                // 既存の権限を更新してmatch_idを設定
                                await adminSupabase
                                    .from('user_permissions')
                                    .update({ match_id: nextMatch.id })
                                    .eq('id', existingPermission.id);
                            } else {
                                // 新しい審判権限を作成
                                await adminSupabase
                                    .from('user_permissions')
                                    .insert({
                                        user_id: team.team_manager_user_id,
                                        role_type: 'umpire',
                                        tournament_id: nextMatch.tournament_id,
                                        team_id: null,
                                        match_id: nextMatch.id,
                                    });
                            }

                            // 次試合のumpire_idを更新
                            await supabase
                                .from('matches')
                                .update({ umpire_id: team.team_manager_user_id })
                                .eq('id', nextMatch.id);
                        }
                    }
                }
            }
        }

        return NextResponse.json(updatedMatch);
    } catch (error) {
        console.error('Finish match error:', error);
        return NextResponse.json(
            { error: '試合の終了に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

