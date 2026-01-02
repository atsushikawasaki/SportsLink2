import { getTournamentTeams } from './getTournamentTeams';
import { addTournamentTeam } from './addTournamentTeam';

// GET /api/tournaments/:id/teams - チーム一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTournamentTeams(id);
}

// POST /api/tournaments/:id/teams - チーム追加
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return addTournamentTeam(id, request);
}
