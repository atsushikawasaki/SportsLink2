import { getMatchPairs } from './getMatchPairs';
import { submitMatchPairs } from './submitMatchPairs';

// GET /api/matches/:id/pairs - ペア取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getMatchPairs(id, request);
}

// POST /api/matches/:id/pairs - ペア提出
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return submitMatchPairs(id, request);
}

