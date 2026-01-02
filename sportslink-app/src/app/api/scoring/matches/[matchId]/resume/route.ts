import { resumeMatch } from './resumeMatch';

// POST /api/scoring/matches/:matchId/resume - 試合再開
export async function POST(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return resumeMatch(matchId);
}
    try {
        const { matchId } = await params;
        const supabase = await createClient();

        // 試合ステータスを確認
        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('status')
            .eq('id', matchId)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
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

