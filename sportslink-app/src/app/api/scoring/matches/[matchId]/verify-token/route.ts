import { verifyToken } from './verifyToken';

// POST /api/scoring/matches/:matchId/verify-token - 認証キー検証
export async function POST(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return verifyToken(matchId, request);
}
