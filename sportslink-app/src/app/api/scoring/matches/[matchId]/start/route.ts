import { startMatch } from './startMatch';

// POST /api/scoring/matches/:matchId/start - 試合開始
export async function POST(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return startMatch(matchId);
}
