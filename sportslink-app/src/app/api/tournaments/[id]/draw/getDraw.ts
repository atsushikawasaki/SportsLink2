import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/draw - ドロー取得
export async function getDraw(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: '認証が必要です', code: 'E-AUTH-001' }, { status: 401 });
        }
        const canRead = await isAdmin(user.id) || await isTournamentAdmin(user.id, id);
        if (!canRead) {
            return NextResponse.json({ error: 'この大会のドローを閲覧する権限がありません', code: 'E-RLS-002' }, { status: 403 });
        }

        const adminClient = createAdminClient();

        // Tournament_Phasesを取得（RLSをバイパスして確実に取得）
        const { data: phases, error: phasesError } = await adminClient
            .from('tournament_phases')
            .select('*')
            .eq('tournament_id', id)
            .order('sequence', { ascending: true });

        if (phasesError) {
            console.error('Get draw phases error:', phasesError);
            return NextResponse.json(
                { error: 'フェーズの取得に失敗しました', code: 'E-DB-001', details: phasesError.message },
                { status: 500 }
            );
        }

        // 各フェーズの試合を取得（phase が無い場合は試合も無い）
        const phaseIds = phases?.map((p) => p.id) ?? [];
        let matches: Record<string, unknown>[] = [];
        if (phaseIds.length > 0) {
            const { data: matchesData, error: matchesError } = await adminClient
                .from('matches')
                .select(`
                    *,
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
                console.error('Get draw matches error:', matchesError);
                return NextResponse.json(
                    { error: '試合の取得に失敗しました', code: 'E-DB-001', details: matchesError.message },
                    { status: 500 }
                );
            }
            matches = (matchesData ?? []) as Record<string, unknown>[];

            // match_slots はスキーマキャッシュのリレーションが無いため別クエリで取得して結合
            const matchIds = matches.map((m) => m.id as string);
            if (matchIds.length > 0) {
                try {
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
                        .order('slot_number', { ascending: true });

                    if (!slotsError && slotsData) {
                        const slotsByMatchId = (slotsData as { match_id: string }[]).reduce(
                            (acc, slot) => {
                                const mid = slot.match_id;
                                if (!acc[mid]) acc[mid] = [];
                                acc[mid].push(slot);
                                return acc;
                            },
                            {} as Record<string, unknown[]>
                        );
                        matches = matches.map((m) => ({
                            ...m,
                            match_slots: slotsByMatchId[m.id as string] ?? [],
                        }));
                    }
                } catch (slotsErr) {
                    console.warn('match_slots fetch skipped (e.g. table not in schema cache):', slotsErr);
                    matches = matches.map((m) => ({ ...m, match_slots: [] }));
                }
            }
        }

        return NextResponse.json({
            phases: phases ?? [],
            matches,
        });
    } catch (error) {
        console.error('Get draw error:', error);
        return NextResponse.json(
            {
                error: 'ドローの取得に失敗しました',
                code: 'E-SERVER-001',
                details: error instanceof Error ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

