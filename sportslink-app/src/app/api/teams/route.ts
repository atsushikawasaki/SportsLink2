import { getTeams } from './getTeams';
import { createTeam } from './createTeam';

// GET /api/teams - チーム一覧取得
export async function GET(request: Request) {
    return getTeams(request);
}

// POST /api/teams - チーム作成
export async function POST(request: Request) {
    return createTeam(request);
}

