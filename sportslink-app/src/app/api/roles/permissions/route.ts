import { getPermissions } from './getPermissions';

// GET /api/roles/permissions - 権限一覧取得
export async function GET() {
    return getPermissions();
}

