import { getTournamentEntries } from './getTournamentEntries';

// GET /api/tournaments/:id/entries - エントリー一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTournamentEntries(id);
}

