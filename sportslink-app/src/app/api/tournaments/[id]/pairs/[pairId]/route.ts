import { updateTournamentPair } from './updateTournamentPair';
import { deleteTournamentPair } from './deleteTournamentPair';

// PUT /api/tournaments/:id/pairs/:pairId - ペア更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string; pairId: string }> }
) {
    const { id, pairId } = await params;
    return updateTournamentPair(id, pairId, request);
}

// DELETE /api/tournaments/:id/pairs/:pairId - ペア削除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; pairId: string }> }
) {
    const { id, pairId } = await params;
    return deleteTournamentPair(id, pairId);
}

