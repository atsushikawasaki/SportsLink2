import { getTournamentRoles } from './getTournamentRoles';

// GET /api/roles/tournaments/:tournamentId - 大会のロール一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ tournamentId: string }> }
) {
    const { tournamentId } = await params;
    return getTournamentRoles(tournamentId);
}

