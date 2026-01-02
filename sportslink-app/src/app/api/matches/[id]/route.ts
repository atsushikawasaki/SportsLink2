import { getMatch } from './getMatch';
import { updateMatch } from './updateMatch';
import { deleteMatch } from './deleteMatch';

// GET /api/matches/:id - 試合詳細取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getMatch(id);
}

// PUT /api/matches/:id - 試合更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return updateMatch(id, request);
}

// DELETE /api/matches/:id - 試合削除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return deleteMatch(id);
}
