import { confirmMatch } from './confirmMatch';

// POST /api/matches/:id/confirm - 試合確定（大会運営者のみ）
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return confirmMatch(id);
}
