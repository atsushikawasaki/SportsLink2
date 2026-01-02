import { getEntryToken } from './getEntryToken';

// GET /api/tournaments/:id/entries/:entryId/token - 認証キー取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; entryId: string }> }
) {
    const { id, entryId } = await params;
    return getEntryToken(id, entryId);
}
