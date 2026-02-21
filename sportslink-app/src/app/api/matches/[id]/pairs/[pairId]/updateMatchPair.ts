import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateMatchPairSchema = z.object({
    pair_number: z.number().int().min(1).optional(),
    team_id: z.string().uuid().optional(),
    player_1_id: z.string().uuid().optional(),
    player_2_id: z.string().uuid().nullable().optional(),
}).strict();

// PUT /api/matches/:id/pairs/:pairId - ペア更新（審判または大会管理者または管理者、許可カラムのみ更新）
export async function updateMatchPair(id: string, pairId: string, request: Request) {
    try {
        const bodyResult = updateMatchPairSchema.safeParse(await request.json());
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

        const { data: matchMeta, error: matchError } = await supabase
            .from('matches')
            .select('tournament_id')
            .eq('id', id)
            .single();
        if (matchError || !matchMeta) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }
        const tournamentId = matchMeta.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, id),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'このペアを更新する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from('match_pairs')
            .update(updatePayload)
            .eq('id', pairId)
            .eq('match_id', id)
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
        console.error('Update match pair error:', error);
        return NextResponse.json(
            { error: 'ペアの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
