import { getMatchScore } from './getMatchScore';
import { updateMatchScore } from './updateMatchScore';

// GET /api/scoring/matches/:matchId/score - 試合スコア取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return getMatchScore(matchId);
}

// PUT /api/scoring/matches/:matchId/score - スコアの直接修正（管理者用）
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return updateMatchScore(matchId, request);
}
