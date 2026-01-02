import { getTermsVersions } from './getTermsVersions';

// GET /api/terms/versions - 利用可能なバージョン一覧を取得
export async function GET() {
    return getTermsVersions();
}

