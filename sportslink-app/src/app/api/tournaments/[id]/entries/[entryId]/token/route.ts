import { getEntryToken } from './getEntryToken';

// GET /api/tournaments/:id/entries/:entryId/token - 認証キー取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; entryId: string }> }
) {
    const { id, entryId } = await params;
    return getEntryToken(id, entryId);
}
    try {
        const { id, entryId } = await params;
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournament_entries')
            .select('day_token, is_checked_in')
            .eq('id', entryId)
            .eq('tournament_id', id)
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: 'エントリーが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            day_token: data.day_token,
            is_checked_in: data.is_checked_in,
        });
    } catch (error) {
        console.error('Get token error:', error);
        return NextResponse.json(
            { error: '認証キーの取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}


