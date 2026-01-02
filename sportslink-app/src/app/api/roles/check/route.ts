import { checkRole } from './checkRole';

// POST /api/roles/check - 権限チェック
export async function POST(request: Request) {
    return checkRole(request);
}

