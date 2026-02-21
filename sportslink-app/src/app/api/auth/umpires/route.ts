import { getUmpires } from './getUmpires';

export const dynamic = 'force-dynamic';

// GET /api/auth/umpires - 審判一覧取得
export async function GET(request: Request) {
    return getUmpires(request);
}

