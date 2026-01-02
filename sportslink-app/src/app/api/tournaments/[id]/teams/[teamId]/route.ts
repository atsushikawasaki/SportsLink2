import { deleteTournamentTeam } from './deleteTournamentTeam';

// DELETE /api/tournaments/:id/teams/:teamId - チーム削除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; teamId: string }> }
) {
    const { id, teamId } = await params;
    return deleteTournamentTeam(id, teamId);
}
