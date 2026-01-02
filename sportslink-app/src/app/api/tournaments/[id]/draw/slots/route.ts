import { updateDrawSlots } from './updateDrawSlots';

// PUT /api/tournaments/:id/draw/slots - ドロースロット更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return updateDrawSlots(id, request);
}
