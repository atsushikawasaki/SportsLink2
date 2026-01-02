import { getDraw } from './getDraw';
import { updateDraw } from './updateDraw';

// GET /api/tournaments/:id/draw - ドロー取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getDraw(id);
}

// PUT /api/tournaments/:id/draw - ドロー更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return updateDraw(id, request);
}

