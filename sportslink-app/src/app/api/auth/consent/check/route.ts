import { checkConsent } from './checkConsent';

// GET /api/auth/consent/check - 規約同意状況チェック
export async function GET(request: Request) {
    return checkConsent(request);
}

