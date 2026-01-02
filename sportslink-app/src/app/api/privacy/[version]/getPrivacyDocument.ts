import { NextResponse } from 'next/server';
import { loadMarkdownDocument } from '@/lib/markdown-loader';

// GET /api/privacy/:version - プライバシーポリシーを取得
export async function getPrivacyDocument(version: string) {
    try {
        const document = await loadMarkdownDocument('privacy', version);
        return NextResponse.json(document);
    } catch (error) {
        console.error('Get privacy error:', error);
        return NextResponse.json(
            { error: 'プライバシーポリシーの取得に失敗しました', code: 'E-NOT-FOUND' },
            { status: 404 }
        );
    }
}

