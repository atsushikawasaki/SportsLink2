import { checkinEntry } from './checkinEntry';

// POST /api/tournaments/:id/entries/:entryId/checkin - 当日受付（チェックイン）
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string; entryId: string }> }
) {
    const { id, entryId } = await params;
    return checkinEntry(id, entryId);
}
