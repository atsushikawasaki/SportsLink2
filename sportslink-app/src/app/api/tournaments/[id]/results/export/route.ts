import { exportResults } from './exportResults';

// GET /api/tournaments/:id/results/export - 試合結果PDFエクスポート
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return exportResults(id, request);
}
