import { getMatchPoints } from './getMatchPoints';

// GET /api/scoring/matches/:matchId/points - ポイント履歴取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return getMatchPoints(matchId);
}
