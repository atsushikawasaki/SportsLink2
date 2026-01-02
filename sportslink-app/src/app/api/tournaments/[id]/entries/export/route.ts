import { exportEntries } from './exportEntries';

// GET /api/tournaments/:id/entries/export - CSVエクスポート
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return exportEntries(id);
}
