import { getMatchScoreById } from './getMatchScoreById';

// GET /api/matches/:id/score - 試合スコア取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getMatchScoreById(id);
}
