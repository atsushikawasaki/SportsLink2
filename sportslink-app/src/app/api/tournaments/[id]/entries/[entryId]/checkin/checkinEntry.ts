import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/tournaments/:id/entries/:entryId/checkin - 当日受付（チェックイン）
export async function checkinEntry(id: string, entryId: string) {
    try {
        const supabase = await createClient();

        // 4桁の認証キーを生成
        const dayToken = Math.floor(1000 + Math.random() * 9000).toString();

        const { data, error } = await supabase
            .from('tournament_entries')
            .update({
                is_checked_in: true,
                day_token: dayToken,
                last_checked_in_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('tournament_id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: 'エントリーが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            ...data,
            day_token: dayToken,
        });
    } catch (error) {
        console.error('Checkin error:', error);
        return NextResponse.json(
            { error: 'チェックインに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

