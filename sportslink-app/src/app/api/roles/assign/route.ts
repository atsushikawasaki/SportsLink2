import { assignRole } from './assignRole';

// POST /api/roles/assign - 権限付与
export async function POST(request: Request) {
    return assignRole(request);
}

