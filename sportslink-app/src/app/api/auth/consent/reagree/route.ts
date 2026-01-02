import { reagreeConsent } from './reagreeConsent';

// POST /api/auth/consent/reagree - 規約再同意
export async function POST(request: Request) {
    return reagreeConsent(request);
}
