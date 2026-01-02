import { exportResults } from './exportResults';

// GET /api/tournaments/:id/results/export - 試合結果PDFエクスポート
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return exportResults(id, request);
}
    try {
        const { id: tournamentId } = await params;
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json'; // 'json' or 'pdf'

        const supabase = await createClient();

        // Get tournament info
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('name')
            .eq('id', tournamentId)
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
                    teams(id, name, school_name)
                )
            `)
            .eq('tournament_id', tournamentId)
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

