import { getPrivacyVersions } from './getPrivacyVersions';

// GET /api/privacy/versions - 利用可能なバージョン一覧を取得
export async function GET() {
    return getPrivacyVersions();
}

