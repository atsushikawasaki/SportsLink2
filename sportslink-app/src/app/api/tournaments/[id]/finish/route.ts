import { finishTournament } from './finishTournament';

// POST /api/tournaments/:id/finish - 大会終了
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return finishTournament(id);
}
    try {
        const { id } = await params;
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournaments')
            .update({ status: 'finished' })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Finish tournament error:', error);
        return NextResponse.json(
            { error: '大会の終了に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
