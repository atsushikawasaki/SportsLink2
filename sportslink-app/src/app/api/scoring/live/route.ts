import { getLiveMatches } from './getLiveMatches';

export const dynamic = 'force-dynamic';

// GET /api/scoring/live - ライブ試合一覧取得
export async function GET(request: Request) {
    return getLiveMatches(request);
}
