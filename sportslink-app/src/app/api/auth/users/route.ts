import { getUsers } from './getUsers';

// GET /api/auth/users - ユーザー一覧取得
export async function GET(request: Request) {
    return getUsers(request);
}

