import { getPrivacyDocument } from './getPrivacyDocument';

// GET /api/privacy/:version - プライバシーポリシーを取得
export async function GET(
    request: Request,
    { params }: { params: Promise<{ version: string }> }
) {
    const { version } = await params;
    return getPrivacyDocument(version);
}

