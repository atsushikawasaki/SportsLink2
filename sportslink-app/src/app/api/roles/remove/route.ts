import { removeRole } from './removeRole';

// DELETE /api/roles/remove - 権限削除
export async function DELETE(request: Request) {
    return removeRole(request);
}

