import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id - 大会詳細取得（認証必須）
export async function getTournament(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return NextResponse.json(
                { error: '大会が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Get tournament error:', error);
        return NextResponse.json(
            { error: '大会の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

