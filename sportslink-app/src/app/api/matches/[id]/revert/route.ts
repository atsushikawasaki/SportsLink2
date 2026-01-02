import { revertMatch } from './revertMatch';

// POST /api/matches/:id/revert - 試合差し戻し（finished → inprogress）
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return revertMatch(id);
}
