import { getCurrentUser } from './getCurrentUser';

export const dynamic = 'force-dynamic';

// GET /api/auth/me - 現在のユーザープロファイル取得
export async function GET(request: Request) {
    return getCurrentUser();
}
