import { publishTournament } from './publishTournament';

// POST /api/tournaments/:id/publish - 大会公開
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return publishTournament(id);
}
