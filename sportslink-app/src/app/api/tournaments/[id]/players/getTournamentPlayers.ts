import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/players - 選手一覧取得
export async function getTournamentPlayers(id: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('tournament_players')
            .select(`
                *,
                teams:team_id (
                    id,
                    name
                )
            `)
            .eq('tournament_id', id)
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: data || [] });
    } catch (error) {
        console.error('Get players error:', error);
        return NextResponse.json(
            { error: '選手一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

