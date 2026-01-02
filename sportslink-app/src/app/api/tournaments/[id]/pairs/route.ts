import { getTournamentPairs } from './getTournamentPairs';
import { addTournamentPair } from './addTournamentPair';

// GET /api/tournaments/:id/pairs - ペア一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTournamentPairs(id);
}

// POST /api/tournaments/:id/pairs - ペア追加
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return addTournamentPair(id, request);
}

