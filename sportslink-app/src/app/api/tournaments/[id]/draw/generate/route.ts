import { NextResponse } from 'next/server';
import { generateDraw } from './generateDraw';

// POST /api/tournaments/:id/draw/generate - ドロー生成
// body: { umpire_initial?: 'guest' | 'unassigned' | 'me' }
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: '大会IDがありません', code: 'E-VER-003' }, { status: 400 });
        }
        return await generateDraw(id, request);
    } catch (err) {
        console.error('Draw generate route error:', err);
        const message = err instanceof Error ? err.message : '不明なエラー';
        return NextResponse.json(
            { error: 'ドローの生成に失敗しました', code: 'E-SERVER-001', details: message },
            { status: 500 }
        );
    }
}

