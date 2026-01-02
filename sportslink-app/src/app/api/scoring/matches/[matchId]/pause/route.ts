import { pauseMatch } from './pauseMatch';

// POST /api/scoring/matches/:matchId/pause - 試合中断
export async function POST(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return pauseMatch(matchId);
}
