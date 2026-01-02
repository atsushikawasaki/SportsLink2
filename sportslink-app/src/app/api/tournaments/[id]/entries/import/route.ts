import { importEntries } from './importEntries';

// POST /api/tournaments/:id/entries/import - CSVインポート
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return importEntries(id, request);
}


