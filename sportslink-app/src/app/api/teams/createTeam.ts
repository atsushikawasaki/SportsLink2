import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/teams - チーム作成
export async function createTeam(request: Request) {
    try {
        const body = await request.json();
        const { name, team_manager_user_id } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'チーム名は必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data, error } = await supabase
            .from('teams')
            .insert({
                name,
                team_manager_user_id: team_manager_user_id ?? null,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Create team error:', error);
        return NextResponse.json(
            { error: 'チームの作成に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

