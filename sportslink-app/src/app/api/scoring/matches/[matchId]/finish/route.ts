import { finishMatch } from './finishMatch';

// POST /api/scoring/matches/:matchId/finish - 試合終了
export async function POST(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return finishMatch(matchId, request);
}
