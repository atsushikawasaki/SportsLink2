import { isAdmin, isTeamAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updatePlayerSchema = z.object({
    player_name: z.string().min(1).optional(),
    player_type: z.enum(['前衛', '後衛', '両方']).nullable().optional(),
    sort_order: z.number().int().nullable().optional(),
}).strict();

// PUT /api/teams/players/:playerId - 選手更新（チーム管理者または管理者、許可カラムのみ更新）
export async function updatePlayer(playerId: string, request: Request) {
    try {
        const bodyResult = updatePlayerSchema.safeParse(await request.json());
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

        const { data: player, error: playerError } = await supabase
            .from('tournament_players')
            .select('actual_team_id')
            .eq('id', playerId)
            .single();
        if (playerError || !player) {
            return NextResponse.json(
                { error: '選手が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }
        const teamId = player.actual_team_id as string;
        const [teamAdmin, admin] = await Promise.all([
            isTeamAdmin(authUser.id, teamId),
            isAdmin(authUser.id),
        ]);
        if (!teamAdmin && !admin) {
            return NextResponse.json(
                { error: 'この選手を更新する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from('tournament_players')
            .update(updatePayload)
            .eq('id', playerId)
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
        console.error('Update player error:', error);
        return NextResponse.json(
            { error: '選手の更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
