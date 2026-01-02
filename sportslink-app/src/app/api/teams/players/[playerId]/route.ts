import { updatePlayer } from './updatePlayer';
import { deletePlayer } from './deletePlayer';

// PUT /api/teams/players/:playerId - 選手更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ playerId: string }> }
) {
    const { playerId } = await params;
    return updatePlayer(playerId, request);
}

// DELETE /api/teams/players/:playerId - 選手削除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ playerId: string }> }
) {
    const { playerId } = await params;
    return deletePlayer(playerId);
}
