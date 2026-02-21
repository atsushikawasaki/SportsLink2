import { reagreeConsent } from './reagreeConsent';
import { NextResponse } from 'next/server';

// POST /api/auth/consent/reagree - 規約再同意
export async function POST(request: Request) {
    try {
        return await reagreeConsent(request);
    } catch (error) {
        console.error('Re-consent route error:', error);
        const message = error instanceof Error ? error.message : String(error);
        const isDev = process.env.NODE_ENV === 'development';
        return NextResponse.json(
            {
                error: isDev ? message : '再同意の処理に失敗しました',
                code: 'E-SERVER-001',
            },
            { status: 500 }
        );
    }
}
