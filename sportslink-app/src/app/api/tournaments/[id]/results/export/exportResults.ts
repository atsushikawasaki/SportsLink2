import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/results/export - 試合結果エクスポート（大会管理者または管理者）
export async function exportResults(id: string, request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json'; // 'json' or 'pdf'

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
                { error: 'この大会の結果をエクスポートする権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        // Get tournament info
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('name')
            .eq('id', id)
            .single();

        if (tournamentError || !tournament) {
            return NextResponse.json(
                { error: '大会が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        // Get finished matches with scores and teams
        const { data: matches, error: matchesError } = await supabase
            .from('matches')
            .select(`
                *,
                match_scores(*),
                match_pairs(
                    *,
                    teams(id, name)
                )
            `)
            .eq('tournament_id', id)
            .eq('status', 'finished')
            .order('round_index', { ascending: true })
            .order('slot_index', { ascending: true });

        if (matchesError) {
            return NextResponse.json(
                { error: '試合結果の取得に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // Format match results
        const results = (matches || []).map((match) => {
            const pairs = match.match_pairs || [];
            const teamA = pairs.find((p: any) => p.pair_number === 1)?.teams;
            const teamB = pairs.find((p: any) => p.pair_number === 2)?.teams;
            const score = match.match_scores?.[0];

            return {
                round_name: match.round_name,
                teamA: teamA?.name || '未設定',
                teamB: teamB?.name || '未設定',
                scoreA: score?.game_count_a || 0,
                scoreB: score?.game_count_b || 0,
                final_score: score?.final_score || '',
                court_number: match.court_number,
                started_at: match.started_at,
            };
        });

        if (format === 'pdf') {
            // Return JSON data for client-side PDF generation
            // Client will use jsPDF to generate PDF
            return NextResponse.json({
                tournament: tournament.name,
                results,
                format: 'pdf_data',
            });
        }

        // Return JSON format
        return NextResponse.json({
            tournament: tournament.name,
            results,
            count: results.length,
        });
    } catch (error) {
        console.error('Export results error:', error);
        return NextResponse.json(
            { error: '試合結果のエクスポートに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

