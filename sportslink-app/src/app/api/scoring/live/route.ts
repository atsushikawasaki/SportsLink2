import { getLiveMatches } from './getLiveMatches';

// GET /api/scoring/live - ライブ試合一覧取得
export async function GET(request: Request) {
    return getLiveMatches(request);
}
