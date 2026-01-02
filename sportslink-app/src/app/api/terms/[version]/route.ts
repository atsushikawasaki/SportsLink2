import { getTermsDocument } from './getTermsDocument';

// GET /api/terms/:version - 利用規約を取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ version: string }> }
) {
    const { version } = await params;
    return getTermsDocument(version);
}

