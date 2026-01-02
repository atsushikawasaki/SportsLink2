import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/tournaments/:id/draw - ドロー更新
export async function updateDraw(id: string, request: Request) {
    try {
        const body = await request.json();
        const { matches } = body; // matches: Array<{ id, umpire_id, court_number, ... }>

        if (!Array.isArray(matches)) {
            return NextResponse.json(
                { error: '試合データが必要です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // 各試合を更新
        const updates = matches.map((match: any) =>
            supabase
                .from('matches')
                .update({
                    umpire_id: match.umpire_id,
                    court_number: match.court_number,
                    status: match.status,
                })
                .eq('id', match.id)
        );

        const results = await Promise.all(updates);
        const errors = results.filter((r) => r.error);

        if (errors.length > 0) {
            return NextResponse.json(
                { error: '一部の試合の更新に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'ドローを更新しました' });
    } catch (error) {
        console.error('Update draw error:', error);
        return NextResponse.json(
            { error: 'ドローの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

