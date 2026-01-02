import { getUserRoles } from './getUserRoles';

// GET /api/roles/users/:userId - ユーザーのロール一覧取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    return getUserRoles(userId);
}

