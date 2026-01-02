import { getMatchPoints } from './getMatchPoints';

// GET /api/scoring/matches/:matchId/points - ポイント履歴取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return getMatchPoints(matchId);
}
    try {
        const { matchId } = await params;
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('points')
            .select('*')
            .eq('match_id', matchId)
            .eq('is_undone', false)
            .order('server_received_at', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: data || [] });
    } catch (error) {
        console.error('Get points error:', error);
        return NextResponse.json(
            { error: 'ポイント履歴の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

