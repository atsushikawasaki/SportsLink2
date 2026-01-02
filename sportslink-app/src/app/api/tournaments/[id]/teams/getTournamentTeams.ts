import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/teams - チーム一覧取得
export async function getTournamentTeams(id: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .eq('tournament_id', id)
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Get teams error:', error);
        return NextResponse.json(
            { error: 'チーム一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

