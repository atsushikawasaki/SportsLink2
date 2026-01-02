import { verifyToken } from './verifyToken';

// POST /api/scoring/matches/:matchId/verify-token - 認証キー検証
export async function POST(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return verifyToken(matchId, request);
}
    try {
        const { matchId } = await params;
        const body = await request.json();
        const { day_token } = body;

        if (!day_token) {
            return NextResponse.json(
                { error: '認証キーが必要です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // 試合情報を取得
        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('tournament_id')
            .eq('id', matchId)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        // 認証キーを検証（Tournament_Entriesから検索）
        const { data: entry, error: entryError } = await supabase
            .from('tournament_entries')
            .select('id, is_checked_in, day_token')
            .eq('tournament_id', match.tournament_id)
            .eq('day_token', day_token)
            .eq('is_checked_in', true)
            .single();

        if (entryError || !entry) {
            return NextResponse.json(
                { error: '認証キーが無効です', code: 'E-VER-003' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            valid: true,
            message: '認証キーが確認されました',
        });
    } catch (error) {
        console.error('Verify token error:', error);
        return NextResponse.json(
            { error: '認証キーの検証に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

