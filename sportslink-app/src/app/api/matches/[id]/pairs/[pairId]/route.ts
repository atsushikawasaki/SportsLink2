import { updateMatchPair } from './updateMatchPair';
import { deleteMatchPair } from './deleteMatchPair';

// PUT /api/matches/:id/pairs/:pairId - ペア更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string; pairId: string }> }
) {
    const { id, pairId } = await params;
    return updateMatchPair(id, pairId, request);
}

// DELETE /api/matches/:id/pairs/:pairId - ペア削除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; pairId: string }> }
) {
    const { id, pairId } = await params;
    return deleteMatchPair(id, pairId);
}

