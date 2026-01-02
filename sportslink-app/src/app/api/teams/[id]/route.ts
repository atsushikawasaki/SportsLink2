import { getTeam } from './getTeam';
import { updateTeam } from './updateTeam';
import { deleteTeam } from './deleteTeam';

// GET /api/teams/:id - チーム詳細取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTeam(id);
}

// PUT /api/teams/:id - チーム更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return updateTeam(id, request);
}

// DELETE /api/teams/:id - チーム削除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return deleteTeam(id);
}

