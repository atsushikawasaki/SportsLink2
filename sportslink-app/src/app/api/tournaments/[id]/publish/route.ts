import { publishTournament } from './publishTournament';

// POST /api/tournaments/:id/publish - 大会公開
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return publishTournament(id);
}
    try {
        const { id } = await params;
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournaments')
            .update({ status: 'published', is_public: true })
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
        console.error('Publish tournament error:', error);
        return NextResponse.json(
            { error: '大会の公開に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
