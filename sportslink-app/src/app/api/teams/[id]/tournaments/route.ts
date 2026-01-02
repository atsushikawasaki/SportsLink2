import { getTeamTournaments } from './getTeamTournaments';

// GET /api/teams/:id/tournaments - チームの参加大会一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTeamTournaments(id);
}
