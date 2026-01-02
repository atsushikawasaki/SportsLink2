import { assignMatch } from './assignMatch';

// PUT /api/matches/:id/assign - 試合割当（審判・コート）
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return assignMatch(id, request);
}
