import { getUsers } from './getUsers';

export const dynamic = 'force-dynamic';

// GET /api/auth/users - ユーザー一覧取得
export async function GET(request: Request) {
    return getUsers(request);
}

