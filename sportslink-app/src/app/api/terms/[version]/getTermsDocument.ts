import { NextResponse } from 'next/server';
import { loadMarkdownDocument } from '@/lib/markdown-loader';

// GET /api/terms/:version - 利用規約を取得
export async function getTermsDocument(version: string) {
    try {
        const document = await loadMarkdownDocument('terms', version);
        return NextResponse.json(document);
    } catch (error) {
        console.error('Get terms error:', error);
        return NextResponse.json(
            { error: '利用規約の取得に失敗しました', code: 'E-NOT-FOUND' },
            { status: 404 }
        );
    }
}

