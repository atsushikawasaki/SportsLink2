import { NextResponse } from 'next/server';
import { getAvailableVersions } from '@/lib/markdown-loader';

// GET /api/privacy/versions - 利用可能なバージョン一覧を取得
export async function getPrivacyVersions() {
    try {
        const versions = await getAvailableVersions('privacy');
        return NextResponse.json({ versions });
    } catch (error) {
        console.error('Get privacy versions error:', error);
        return NextResponse.json(
            { error: 'バージョン一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

