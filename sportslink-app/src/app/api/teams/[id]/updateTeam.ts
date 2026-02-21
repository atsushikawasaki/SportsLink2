import { isAdmin, isTeamAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateTeamSchema = z.object({
    name: z.string().min(1).optional(),
    team_manager_user_id: z.string().uuid().nullable().optional(),
}).strict();

// PUT /api/teams/:id - チーム更新（チーム管理者または管理者、許可カラムのみ更新）
export async function updateTeam(id: string, request: Request) {
    try {
        const bodyResult = updateTeamSchema.safeParse(await request.json());
        if (!bodyResult.success) {
            return NextResponse.json(
                { error: 'リクエスト内容が不正です', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        const updatePayload = bodyResult.data as Record<string, unknown>;
        const keys = Object.keys(updatePayload);
        if (keys.length === 0) {
            return NextResponse.json(
                { error: '更新する項目がありません', code: 'E-VER-003' },
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

        const [teamAdmin, admin] = await Promise.all([
            isTeamAdmin(authUser.id, id),
            isAdmin(authUser.id),
        ]);
        if (!teamAdmin && !admin) {
            return NextResponse.json(
                { error: 'このチームを更新する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from('teams')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Update team error:', error);
        return NextResponse.json(
            { error: 'チームの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
