import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { NextResponse } from 'next/server';

export type DrawTreeMatch = {
    id: string;
    round_index: number | null;
    slot_index: number | null;
    round_name: string;
    status: string;
    match_number: number | null;
    next_match_id: string | null;
    winner_source_match_a: string | null;
    winner_source_match_b: string | null;
    parent_match_id: string | null;
    match_type: string | null;
    match_slots?: unknown[];
    match_scores?: { game_count_a: number; game_count_b: number }[];
    match_pairs?: unknown[];
};

export type DrawTreeRound = {
    round_index: number;
    round_name: string;
    matches: DrawTreeMatch[];
};

// GET /api/tournaments/:id/draw/tree - ドローをラウンド別ツリー構造で取得（ブラケット描画用）
export async function getDrawTree(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: '認証が必要です', code: 'E-AUTH-001' }, { status: 401 });
        }
        const canRead = await isAdmin(user.id) || await isTournamentAdmin(user.id, id);
        if (!canRead) {
            return NextResponse.json({ error: 'この大会のドローを閲覧する権限がありません', code: 'E-AUTH-002' }, { status: 403 });
        }

        const adminClient = createAdminClient();

        const { data: phases, error: phasesError } = await adminClient
            .from('tournament_phases')
            .select('*')
            .eq('tournament_id', id)
            .order('sequence', { ascending: true });

        if (phasesError || !phases?.length) {
            return NextResponse.json({
                rounds: [],
                phases: [],
                can_regenerate: true,
            });
        }

        const phaseIds = phases.map((p) => p.id);
        const { data: matchesData, error: matchesError } = await adminClient
            .from('matches')
            .select(`
                id,
                round_index,
                slot_index,
                round_name,
                status,
                match_number,
                next_match_id,
                winner_source_match_a,
                winner_source_match_b,
                parent_match_id,
                match_type,
                match_scores (
                    game_count_a,
                    game_count_b
                ),
                match_pairs (
                    id,
                    pair_number,
                    team_id,
                    teams:team_id (
                        id,
                        name
                    )
                )
            `)
            .in('phase_id', phaseIds)
            .order('round_index', { ascending: true })
            .order('slot_index', { ascending: true });

        if (matchesError) {
            return NextResponse.json(
                { error: '試合の取得に失敗しました', code: 'E-DB-001', details: matchesError.message },
                { status: 500 }
            );
        }

        let matches = (matchesData ?? []) as DrawTreeMatch[];
        const parentMatchIds = new Set(matches.filter((m) => m.parent_match_id).map((m) => m.parent_match_id));
        matches = matches.filter((m) => !parentMatchIds.has(m.id));

        const matchIds = matches.map((m) => m.id);
        if (matchIds.length > 0) {
            const { data: slotsData, error: slotsError } = await adminClient
                .from('match_slots')
                .select(`
                    id,
                    match_id,
                    slot_number,
                    source_type,
                    entry_id,
                    source_match_id,
                    placeholder_label,
                    tournament_entries:entry_id (
                        id,
                        entry_type,
                        region_name,
                        custom_display_name,
                        team_id,
                        teams:team_id (
                            id,
                            name
                        )
                    )
                `)
                .in('match_id', matchIds)
                .order('slot_number', { ascending: true })
                .limit(1000);

            if (!slotsError && slotsData) {
                const slotsByMatchId = (slotsData as { match_id: string }[]).reduce<Record<string, unknown[]>>(
                    (acc, slot) => {
                        const mid = slot.match_id;
                        if (!acc[mid]) acc[mid] = [];
                        acc[mid].push(slot);
                        return acc;
                    },
                    {}
                );
                matches = matches.map((m) => ({
                    ...m,
                    match_slots: slotsByMatchId[m.id] ?? [],
                }));
            }
        }

        const roundMap = new Map<number, DrawTreeMatch[]>();
        for (const m of matches) {
            const r = m.round_index ?? 0;
            if (!roundMap.has(r)) roundMap.set(r, []);
            roundMap.get(r)!.push(m);
        }
        const rounds: DrawTreeRound[] = Array.from(roundMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([round_index, matchesInRound]) => ({
                round_index,
                round_name: matchesInRound[0]?.round_name ?? `ラウンド${round_index}`,
                matches: matchesInRound.sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0)),
            }));

        const inProgressOrFinished = matches.filter(
            (m) => m.status === 'inprogress' || m.status === 'finished'
        );
        const hasInProgress = inProgressOrFinished.some((m) => m.status === 'inprogress');
        let canRegenerate = !hasInProgress;
        if (!hasInProgress && inProgressOrFinished.length > 0) {
            const finishedMatchIds = inProgressOrFinished
                .filter((m) => m.status === 'finished')
                .map((m) => m.id);
            const { data: scoresData } = await adminClient
                .from('match_scores')
                .select('match_id, winning_reason')
                .in('match_id', finishedMatchIds);
            const scores = (scoresData ?? []) as { match_id: string; winning_reason: string }[];
            const matchIdToReasons = scores.reduce<Record<string, string[]>>((acc, s) => {
                if (!acc[s.match_id]) acc[s.match_id] = [];
                acc[s.match_id].push(s.winning_reason);
                return acc;
            }, {});
            const hasRealFinished = finishedMatchIds.some((matchId) => {
                const reasons = matchIdToReasons[matchId] ?? [];
                const isByeOnly =
                    reasons.length === 0 ||
                    reasons.every((r) => r === 'DEFAULT' || r == null);
                return !isByeOnly;
            });
            canRegenerate = !hasRealFinished;
        }

        return NextResponse.json({ rounds, phases: phases ?? [], can_regenerate: canRegenerate });
    } catch (error) {
        console.error('Get draw tree error:', error);
        return NextResponse.json(
            {
                error: 'ドローツリーの取得に失敗しました',
                code: 'E-SERVER-001',
                details: error instanceof Error ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}
