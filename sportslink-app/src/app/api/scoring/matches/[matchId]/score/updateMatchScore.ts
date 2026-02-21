import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/scoring/matches/:matchId/score - スコアの直接修正（審判または大会管理者または管理者）
export async function updateMatchScore(matchId: string, request: Request) {
    try {
        const body = await request.json();
        const { game_count_a, game_count_b, final_score } = body;

        const a = Number(game_count_a);
        const b = Number(game_count_b);
        if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
            return NextResponse.json(
                { error: 'game_count_a, game_count_b は 0 以上の数値である必要があります', code: 'E-VER-003' },
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

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('id, status, tournament_id')
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
                { error: 'この試合のスコアを変更する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        if (match.status === 'finished') {
            return NextResponse.json(
                { error: '終了済みの試合のスコアは直接変更できません。差し戻し後に編集してください。', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { data: oldRow } = await supabase
            .from('match_scores')
            .select('*')
            .eq('match_id', matchId)
            .maybeSingle();

        const { data, error } = await supabase
            .from('match_scores')
            .upsert(
                {
                    match_id: matchId,
                    game_count_a: a,
                    game_count_b: b,
                    final_score: final_score ?? null,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'match_id' }
            )
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        await supabase.from('audit_logs').insert({
            table_name: 'match_scores',
            operation_type: oldRow ? 'UPDATE' : 'INSERT',
            record_id: matchId,
            old_data: oldRow ?? null,
            new_data: data,
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Update score error:', error);
        return NextResponse.json(
            { error: 'スコアの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

