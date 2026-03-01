import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const submitMatchPairsBodySchema = z.object({
    pairs: z.array(z.object({
        pair_number: z.number().int().min(1),
        team_id: z.string().uuid(),
        player_1_id: z.string().uuid(),
        player_2_id: z.string().uuid().nullable().optional(),
    })).min(1),
}).strict();

// POST /api/matches/:id/pairs - ペア提出（審判または大会管理者または管理者）
export async function submitMatchPairs(id: string, request: Request) {
    try {
        const bodyResult = submitMatchPairsBodySchema.safeParse(await request.json());
        if (!bodyResult.success) {
            return NextResponse.json(
                { error: 'ペア情報の形式が不正です（pair_number, team_id, player_1_id は必須。UUID形式で指定してください）', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        const { pairs } = bodyResult.data;

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
            .select('tournament_id, status')
            .eq('id', id)
            .single();
        if (matchError || !matchMeta) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (matchMeta.status === 'finished') {
            return NextResponse.json(
                { error: '終了した試合のペアは変更できません', code: 'E-VER-003' },
                { status: 400 }
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
                { error: 'この試合のペアを提出する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        // 既存のペアを削除
        const { error: deleteError } = await supabase
            .from('match_pairs')
            .delete()
            .eq('match_id', id);

        if (deleteError) {
            return NextResponse.json(
                { error: deleteError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const pairsToInsert = pairs.map((pair) => ({
            match_id: id,
            pair_number: pair.pair_number,
            team_id: pair.team_id,
            player_1_id: pair.player_1_id,
            player_2_id: pair.player_2_id ?? null,
        }));

        const { data, error: insertError } = await supabase
            .from('match_pairs')
            .insert(pairsToInsert)
            .select();

        if (insertError) {
            return NextResponse.json(
                { error: insertError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        console.error('Submit match pairs error:', error);
        return NextResponse.json(
            { error: 'ペアの提出に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

