import { getUmpireMatches } from './getUmpireMatches';

// GET /api/matches/umpire/:umpireId - 審判の担当試合一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ umpireId: string }> }
) {
    const { umpireId } = await params;
    return getUmpireMatches(umpireId, request);
}

