import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateTournamentSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: z.enum(['draft', 'published', 'finished']).optional(),
    is_public: z.boolean().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    match_format: z.enum(['team_doubles_3', 'team_doubles_4_singles_1', 'individual_doubles', 'individual_singles']).nullable().optional(),
    umpire_mode: z.enum(['LOSER', 'ASSIGNED', 'FREE']).optional(),
}).strict();

// PUT /api/tournaments/:id - 大会更新（大会管理者または管理者または作成者のみ、許可カラムのみ更新）
export async function updateTournament(id: string, request: Request) {
    try {
        const bodyResult = updateTournamentSchema.safeParse(await request.json());
        if (!bodyResult.success) {
            return NextResponse.json(
                { error: 'リクエスト内容が不正です', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        const body = bodyResult.data;

        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: tournament, error: fetchError } = await supabase
            .from('tournaments')
            .select('id, created_by_user_id')
            .eq('id', id)
            .single();
        if (fetchError || !tournament) {
            return NextResponse.json(
                { error: '大会が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const [tournamentAdmin, admin] = await Promise.all([
            isTournamentAdmin(authUser.id, id),
            isAdmin(authUser.id),
        ]);
        const isCreator = (tournament as { created_by_user_id?: string }).created_by_user_id === authUser.id;
        if (!tournamentAdmin && !admin && !isCreator) {
            return NextResponse.json(
                { error: 'この大会を更新する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        if (body.match_format !== undefined) {
            const { count } = await supabase
                .from('tournament_entries')
                .select('id', { count: 'exact', head: true })
                .eq('tournament_id', id)
                .eq('is_active', true);
            if ((count ?? 0) > 0) {
                return NextResponse.json(
                    {
                        error: 'エントリーが登録されている大会では試合形式（match_format）を変更できません。',
                        code: 'E-VER-003',
                    },
                    { status: 400 }
                );
            }
        }

        const updatePayload: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body)) {
            if (v !== undefined) updatePayload[k] = v;
        }
        if (Object.keys(updatePayload).length === 0) {
            return NextResponse.json(
                { error: '更新する項目がありません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('tournaments')
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
        console.error('Update tournament error:', error);
        return NextResponse.json(
            { error: '大会の更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

