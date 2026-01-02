import { confirmMatch } from './confirmMatch';

// POST /api/matches/:id/confirm - 試合確定（大会運営者のみ）
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return confirmMatch(id);
}
    try {
        const { id } = await params;
        const supabase = await createClient();

        // Check if match is finished
        const { data: match, error: fetchError } = await supabase
            .from('matches')
            .select('status, tournament_id')
            .eq('id', id)
            .single();

        if (fetchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (match.status !== 'finished') {
            return NextResponse.json(
                { error: '終了した試合のみ確定できます', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Set is_confirmed to true
        const { data, error } = await supabase
            .from('matches')
            .update({ is_confirmed: true } as never)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '試合を確定しました', data });
    } catch (error) {
        console.error('Confirm match error:', error);
        return NextResponse.json(
            { error: '試合の確定に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

