import { withIdempotency } from '@/lib/idempotency';
import { getMatches } from './getMatches';
import { createMatch } from './createMatch';

// GET /api/matches - 試合一覧取得
export async function GET(request: Request) {
    return getMatches(request);
}

// POST /api/matches - 試合作成
export async function POST(request: Request) {
    return withIdempotency(request, () => createMatch(request));
}
