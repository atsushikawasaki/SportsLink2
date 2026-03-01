import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const submitOrderBodySchema = z.object({
    slot_number: z.union([z.literal(1), z.literal(2)]),
    team_id: z.string().uuid(),
    player_1_id: z.string().uuid(),
    player_2_id: z.string().uuid().nullable().optional(),
}).strict();

/**
 * POST /api/matches/:id/order - オーダー提出（スロット担当チームの監督のみ）。
 * 両チーム提出完了まで相手に開示しない運用のため、ここでは「自スロット」の提出のみ受け付ける。
 */
export async function submitOrder(matchId: string, request: Request) {
    try {
        const bodyResult = submitOrderBodySchema.safeParse(await request.json());
        if (!bodyResult.success) {
            return NextResponse.json(
                { error: 'オーダー形式が不正です（slot_number, team_id, player_1_id は必須。UUID形式）', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        const { slot_number, team_id, player_1_id, player_2_id } = bodyResult.data;

        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json({ error: '認証が必要です', code: 'E-AUTH-001' }, { status: 401 });
        }

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('id, tournament_id, status, order_submitted_slot_1_at, order_submitted_slot_2_at, parent_match_id')
            .eq('id', matchId)
            .single();

        if (matchError || !match) {
            return NextResponse.json({ error: '試合が見つかりません', code: 'E-NOT-FOUND' }, { status: 404 });
        }

        if (match.status === 'finished') {
            return NextResponse.json(
                { error: '終了した試合にオーダーは提出できません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { data: slots } = await supabase
            .from('match_slots')
            .select('slot_number, entry_id')
            .eq('match_id', matchId)
            .order('slot_number', { ascending: true });

        const slotEntry = slots?.find((s) => s.slot_number === slot_number);
        if (!slotEntry?.entry_id) {
            return NextResponse.json(
                { error: 'この試合のスロットにエントリーが割り当てられていません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { data: entry } = await supabase
            .from('tournament_entries')
            .select('team_id')
            .eq('id', slotEntry.entry_id)
            .single();

        const slotTeamId = entry?.team_id ?? null;
        if (slotTeamId !== team_id) {
            return NextResponse.json(
                { error: '指定したチームはこのスロットのチームと一致しません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { data: team } = await supabase
            .from('teams')
            .select('team_manager_user_id')
            .eq('id', team_id)
            .single();

        if ((team?.team_manager_user_id ?? null) !== authUser.id) {
            return NextResponse.json(
                { error: 'このスロットのオーダーを提出できるのはチーム監督のみです', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const pairNumber = slot_number;
        const adminClient = createAdminClient();

        const { data: existingPair } = await adminClient
            .from('match_pairs')
            .select('id')
            .eq('match_id', matchId)
            .eq('pair_number', pairNumber)
            .maybeSingle();

        const pairRow = {
            match_id: matchId,
            pair_number: pairNumber,
            team_id,
            player_1_id,
            player_2_id: player_2_id ?? null,
        };

        if (existingPair?.id) {
            const { error: updateErr } = await adminClient
                .from('match_pairs')
                .update(pairRow)
                .eq('id', existingPair.id);
            if (updateErr) {
                return NextResponse.json(
                    { error: updateErr.message, code: 'E-DB-001' },
                    { status: 500 }
                );
            }
        } else {
            const { error: insertErr } = await adminClient
                .from('match_pairs')
                .insert(pairRow);
            if (insertErr) {
                return NextResponse.json(
                    { error: insertErr.message, code: 'E-DB-001' },
                    { status: 500 }
                );
            }
        }

        const column = slot_number === 1 ? 'order_submitted_slot_1_at' : 'order_submitted_slot_2_at';
        const { error: timestampErr } = await adminClient
            .from('matches')
            .update({ [column]: new Date().toISOString() })
            .eq('id', matchId);

        if (timestampErr) {
            return NextResponse.json(
                { error: timestampErr.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'オーダーを提出しました' }, { status: 200 });
    } catch (error) {
        console.error('Submit order error:', error);
        return NextResponse.json(
            { error: 'オーダーの提出に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
