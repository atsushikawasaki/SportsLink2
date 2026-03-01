import { submitOrder } from './submitOrder';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return submitOrder(id, request);
}
