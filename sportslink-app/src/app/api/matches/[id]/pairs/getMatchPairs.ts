import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/matches/:id/pairs - ペア取得（オーダー秘匿時は両者提出完了まで相手スロットを返さない）
export async function getMatchPairs(id: string, _request?: Request) {
    try {
        const supabase = await createClient();

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('id, order_submitted_slot_1_at, order_submitted_slot_2_at')
            .eq('id', id)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const hasOrderColumns =
            (match as { order_submitted_slot_1_at?: string | null }).order_submitted_slot_1_at !== undefined ||
            (match as { order_submitted_slot_2_at?: string | null }).order_submitted_slot_2_at !== undefined;
        const bothSubmitted =
            !hasOrderColumns ||
            (match.order_submitted_slot_1_at != null && (match as { order_submitted_slot_2_at?: string | null }).order_submitted_slot_2_at != null);
        let allowedPairNumbers: number[] | null = null;

        if (!bothSubmitted) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return NextResponse.json({ error: '認証が必要です', code: 'E-AUTH-001' }, { status: 401 });
            }
            const { data: slots } = await supabase
                .from('match_slots')
                .select('slot_number, entry_id')
                .eq('match_id', id);
            const entryIds = (slots ?? []).map((s) => s.entry_id).filter(Boolean) as string[];
            if (entryIds.length > 0) {
                const { data: entries } = await supabase
                    .from('tournament_entries')
                    .select('id, team_id')
                    .in('id', entryIds);
                const teamIds = (entries ?? []).map((e) => e.team_id).filter(Boolean) as string[];
                const { data: teams } = await supabase
                    .from('teams')
                    .select('id, team_manager_user_id')
                    .in('id', teamIds);
                const slotToTeam = new Map<number, string>();
                for (const s of slots ?? []) {
                    const ent = entries?.find((e) => e.id === s.entry_id);
                    if (ent?.team_id) slotToTeam.set(s.slot_number, ent.team_id);
                }
                const managerTeamIds = (teams ?? [])
                    .filter((t) => t.team_manager_user_id === user.id)
                    .map((t) => t.id);
                allowedPairNumbers = (slots ?? [])
                    .filter((s) => managerTeamIds.includes(slotToTeam.get(s.slot_number) ?? ''))
                    .map((s) => s.slot_number);
            }
        }

        const { data, error } = await supabase
            .from('match_pairs')
            .select(`
                *,
                teams:team_id (
                    id,
                    name
                ),
                tournament_players!match_pairs_player_1_id_fkey (
                    id,
                    player_name,
                    player_type
                ),
                tournament_players!match_pairs_player_2_id_fkey (
                    id,
                    player_name,
                    player_type
                )
            `)
            .eq('match_id', id)
            .order('pair_number', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        let pairs = data ?? [];
        if (allowedPairNumbers !== null) {
            pairs = pairs.filter((p) => allowedPairNumbers!.includes(p.pair_number));
        }

        const payload: { data: unknown[]; order_status?: { slot_1: boolean; slot_2: boolean } } = {
            data: pairs,
        };
        if (!bothSubmitted && match.order_submitted_slot_1_at != null) {
            payload.order_status = {
                slot_1: true,
                slot_2: (match as { order_submitted_slot_2_at?: string | null }).order_submitted_slot_2_at != null,
            };
        } else if (!bothSubmitted && (match as { order_submitted_slot_2_at?: string | null }).order_submitted_slot_2_at != null) {
            payload.order_status = {
                slot_1: match.order_submitted_slot_1_at != null,
                slot_2: true,
            };
        } else if (!bothSubmitted) {
            payload.order_status = {
                slot_1: match.order_submitted_slot_1_at != null,
                slot_2: (match as { order_submitted_slot_2_at?: string | null }).order_submitted_slot_2_at != null,
            };
        }

        return NextResponse.json(payload);
    } catch (error) {
        console.error('Get match pairs error:', error);
        return NextResponse.json(
            { error: 'ペアの取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

