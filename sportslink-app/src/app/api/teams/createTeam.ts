import { isAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/teams - チーム作成（認証必須、team_manager は自分または管理者のみ指定可）
export async function createTeam(request: Request) {
    try {
        const body = await request.json();
        const { name, team_manager_user_id } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'チーム名は必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        if (name.length > 100) {
            return NextResponse.json(
                { error: 'チーム名は100文字以内で入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        let managerId: string | null = team_manager_user_id ?? null;
        if (managerId && managerId !== authUser.id) {
            const admin = await isAdmin(authUser.id);
            if (!admin) {
                return NextResponse.json(
                    { error: 'チーム管理者には自分以外を指定できません', code: 'E-VER-003' },
                    { status: 403 }
                );
            }
        }
        if (!managerId) {
            managerId = authUser.id;
        }

        const { data, error } = await supabase
            .from('teams')
            .insert({
                name,
                team_manager_user_id: managerId,
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

