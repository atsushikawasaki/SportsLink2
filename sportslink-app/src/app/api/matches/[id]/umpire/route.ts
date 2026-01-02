import { removeUmpire } from './removeUmpire';
import { changeUmpire } from './changeUmpire';

// DELETE /api/matches/:id/umpire - 審判権限の強制解除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return removeUmpire(id);
}

// PUT /api/matches/:id/umpire - 審判の強制変更
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return changeUmpire(id, request);
}
