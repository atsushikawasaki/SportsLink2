import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { updateMatchScoresFromPoints } from '@/lib/scoring/aggregateMatchScore';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// POST /api/scoring/points - ポイント入力（審判または大会管理者または管理者）
export async function addPoint(request: Request) {
    try {
        const body = await request.json();
        const { match_id, point_type, client_uuid, matchVersion } = body;

        if (!match_id || !point_type || !client_uuid) {
            return NextResponse.json(
                { error: '必須パラメータが不足しています', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const validPointTypes = ['A_score', 'B_score'];
        if (!validPointTypes.includes(point_type)) {
            return NextResponse.json(
                { error: `不正なpoint_typeです。有効な値: ${validPointTypes.join(', ')}`, code: 'E-VER-003' },
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
            .select('id, version, status, tournament_id')
            .eq('id', match_id)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const tournamentId = match.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, match_id),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合のスコアを操作する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        if (matchVersion && match.version !== matchVersion) {
            return NextResponse.json(
                { error: 'データが競合しています。再同期してください', code: 'E-CONFL-001' },
                { status: 409 }
            );
        }

        if (match.status !== 'inprogress') {
            return NextResponse.json(
                { error: '進行中の試合のみポイントを追加できます', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Insert point
        const { data: point, error: pointError } = await supabase
            .from('points')
            .insert({
                id: uuidv4(),
                match_id,
                point_type,
                client_uuid,
                server_received_at: new Date().toISOString(),
                is_undone: false,
            })
            .select()
            .single();

        if (pointError) {
            return NextResponse.json(
                { error: pointError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const scores = await updateMatchScoresFromPoints(supabase, match_id);

        const { data: updatedMatch, error: versionError } = await supabase
            .from('matches')
            .update({ version: match.version + 1 })
            .eq('id', match_id)
            .eq('version', match.version)
            .select('version')
            .single();

        if (versionError || !updatedMatch) {
            return NextResponse.json(
                { error: 'データが競合しています。再同期してください', code: 'E-CONFL-001' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                point,
                newVersion: updatedMatch.version,
                match_scores: {
                    game_count_a: scores.game_count_a,
                    game_count_b: scores.game_count_b,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Add point error:', error);
        return NextResponse.json(
            { error: 'ポイントの追加に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

