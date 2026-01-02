import { getTeamPlayers } from './getTeamPlayers';
import { addTeamPlayer } from './addTeamPlayer';

// GET /api/teams/:id/players - チームの選手一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTeamPlayers(id);
}

// POST /api/teams/:id/players - 選手追加
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return addTeamPlayer(id, request);
}
