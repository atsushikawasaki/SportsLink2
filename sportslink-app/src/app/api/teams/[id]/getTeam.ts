import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/teams/:id - チーム詳細取得
export async function getTeam(id: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('teams')
            .select(`
                *,
                tournament_players (
                    id,
                    player_name,
                    player_type
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            return NextResponse.json(
                { error: 'チームが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Get team error:', error);
        return NextResponse.json(
            { error: 'チームの取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

