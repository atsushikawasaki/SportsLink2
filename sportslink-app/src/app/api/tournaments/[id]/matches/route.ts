import { getTournamentMatches } from './getTournamentMatches';

// GET /api/tournaments/:id/matches - 大会の試合一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTournamentMatches(id, request);
}
