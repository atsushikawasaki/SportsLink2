import { getTournament } from './getTournament';
import { updateTournament } from './updateTournament';
import { deleteTournament } from './deleteTournament';

// GET /api/tournaments/:id - 大会詳細取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getTournament(id);
}

// PUT /api/tournaments/:id - 大会更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return updateTournament(id, request);
}

// DELETE /api/tournaments/:id - 大会削除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return deleteTournament(id);
}
