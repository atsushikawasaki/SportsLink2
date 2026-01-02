import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/roles/users/:userId - ユーザーの権限一覧取得
export async function getUserRoles(userId: string) {
    try {
        const supabase = await createClient();

        // Get permissions with related tournament, team, and match information
        const { data, error } = await supabase
            .from('user_permissions')
            .select(`
                *,
                tournaments:tournament_id (
                    id,
                    name
                ),
                teams:team_id (
                    id,
                    name
                ),
                matches:match_id (
                    id
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: data || [] });
    } catch (error) {
        console.error('Get user permissions error:', error);
        return NextResponse.json(
            { error: '権限一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

