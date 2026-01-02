import { generateDraw } from './generateDraw';

// POST /api/tournaments/:id/draw/generate - ドロー生成
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return generateDraw(id);
}

