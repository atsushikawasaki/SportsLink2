import { updateMatchStatus } from './updateMatchStatus';

// PUT /api/matches/:id/status - 試合ステータス更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return updateMatchStatus(id, request);
}
