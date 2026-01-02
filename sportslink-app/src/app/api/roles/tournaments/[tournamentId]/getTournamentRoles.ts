import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/roles/tournaments/:tournamentId - 大会の権限一覧取得
export async function getTournamentRoles(tournamentId: string) {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('user_permissions')
            .select(`
                *,
                users:user_id (
                    id,
                    email,
                    display_name
                )
            `)
            .eq('tournament_id', tournamentId)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: data || [] });
    } catch (error) {
        console.error('Get tournament permissions error:', error);
        return NextResponse.json(
            { error: '権限一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

