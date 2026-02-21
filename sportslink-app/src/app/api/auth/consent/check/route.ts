import { checkConsent } from './checkConsent';

export const dynamic = 'force-dynamic';

// GET /api/auth/consent/check - 規約同意状況チェック
export async function GET(request: Request) {
    return checkConsent(request);
}

