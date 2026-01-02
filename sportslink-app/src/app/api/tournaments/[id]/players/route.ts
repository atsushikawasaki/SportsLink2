import { getTournamentPlayers } from './getTournamentPlayers';
import { addTournamentPlayer } from './addTournamentPlayer';

// GET /api/tournaments/:id/players - 選手一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTournamentPlayers(id);
}

// POST /api/tournaments/:id/players - 選手追加
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return addTournamentPlayer(id, request);
}

