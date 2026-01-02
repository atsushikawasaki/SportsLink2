import { getUmpires } from './getUmpires';

// GET /api/auth/umpires - 審判一覧取得
export async function GET(request: Request) {
    return getUmpires(request);
}

