import { getTournamentEntries } from './getTournamentEntries';
import { createTournamentEntry } from './createTournamentEntry';

// GET /api/tournaments/:id/entries - エントリー一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTournamentEntries(id);
}

// POST /api/tournaments/:id/entries - エントリー作成（team / doubles / singles）
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return createTournamentEntry(id, request);
}
