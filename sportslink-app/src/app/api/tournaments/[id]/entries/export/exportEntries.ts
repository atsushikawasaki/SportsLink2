import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isAdmin, isTournamentAdmin } from '@/lib/permissions';

function escapeCsvValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// GET /api/tournaments/:id/entries/export - CSVエクスポート（1レコード = 1エントリー）
export async function exportEntries(id: string) {
    try {
        const supabase = await createClient();

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json({ error: '認証が必要です', code: 'E-AUTH-001' }, { status: 401 });
        }

        const hasPermission = await isAdmin(authUser.id) || await isTournamentAdmin(authUser.id, id);
        if (!hasPermission) {
            return NextResponse.json({ error: 'この操作を実行する権限がありません', code: 'E-AUTH-002' }, { status: 403 });
        }

        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('name, match_format')
            .eq('id', id)
            .single();

        if (tournamentError || !tournament) {
            return NextResponse.json({ error: '大会が見つかりません', code: 'E-NOT-FOUND' }, { status: 404 });
        }

        const { data: entries, error: entriesError } = await supabase
            .from('tournament_entries')
            .select(`
                id,
                entry_type,
                team_id,
                pair_id,
                seed_rank,
                region_name,
                custom_display_name,
                teams:team_id ( id, name )
            `)
            .eq('tournament_id', id)
            .eq('is_active', true)
            .order('seed_rank', { ascending: true, nullsFirst: true })
            .order('created_at', { ascending: true });

        if (entriesError) {
            return NextResponse.json(
                { error: `エントリー情報の取得に失敗しました: ${entriesError.message}`, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const csvHeader = '代表チーム名,地域名,選手1氏名,選手1所属,選手2氏名,選手2所属,シード\n';
        const bom = '\uFEFF';

        if (!entries?.length) {
            return new NextResponse(bom + csvHeader, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="tournament-${id}-entries.csv"`,
                },
            });
        }

        const pairIds = entries
            .map((e) => e.pair_id)
            .filter((pid): pid is string => pid != null);

        const { data: pairs, error: pairsError } =
            pairIds.length > 0
                ? await supabase
                    .from('tournament_pairs')
                    .select(`
                id,
                entry_id,
                player_1_id,
                player_2_id,
                player_1:tournament_players!tournament_pairs_player_1_id_fkey (
                    id,
                    player_name,
                    actual_team_id
                ),
                player_2:tournament_players!tournament_pairs_player_2_id_fkey (
                    id,
                    player_name,
                    actual_team_id
                )
            `)
                    .in('id', pairIds)
                : { data: null, error: null };

        const teamIds = new Set<string>();
        (pairs ?? []).forEach((p: Record<string, unknown>) => {
            const p1 = Array.isArray(p.player_1) ? (p.player_1[0] as { actual_team_id?: string } | undefined) : (p.player_1 as { actual_team_id?: string } | null | undefined);
            const p2 = Array.isArray(p.player_2) ? (p.player_2[0] as { actual_team_id?: string } | undefined) : (p.player_2 as { actual_team_id?: string } | null | undefined);
            if (p1?.actual_team_id) teamIds.add(p1.actual_team_id);
            if (p2?.actual_team_id) teamIds.add(p2.actual_team_id);
        });

        const { data: teams } =
            teamIds.size > 0
                ? await supabase.from('teams').select('id, name').in('id', Array.from(teamIds))
                : { data: [] };

        const teamsById = new Map((teams || []).map((t: { id: string; name: string }) => [t.id, t.name]));

        const pairMap = new Map((pairs ?? []).map((p: { id: string }) => [p.id, p]));
        const csvRows: string[] = [];

        for (const entry of entries) {
            const team = entry.teams as { name?: string } | null;
            const repTeamName = team?.name ?? '';
            const regionName = (entry as { region_name?: string | null }).region_name ?? '';
            const seedRank = (entry as { seed_rank?: number | null }).seed_rank ?? '';

            if (!entry.pair_id) {
                csvRows.push(
                    [escapeCsvValue(repTeamName), escapeCsvValue(regionName), '', '', '', '', escapeCsvValue(seedRank)].join(',')
                );
                continue;
            }
            const pair = pairMap.get(entry.pair_id) as { id: string; player_1?: unknown; player_2?: unknown } | undefined;
            if (!pair) {
                csvRows.push(
                    [escapeCsvValue(repTeamName), escapeCsvValue(regionName), '', '', '', '', escapeCsvValue(seedRank)].join(',')
                );
                continue;
            }

            const player1 = pair.player_1 as { player_name?: string; actual_team_id?: string } | null;
            const player2 = pair.player_2 as { player_name?: string; actual_team_id?: string } | null;
            const p1Name = player1?.player_name ?? '';
            const p1Aff = player1?.actual_team_id ? (teamsById.get(player1.actual_team_id) ?? '') : '';
            const p2Name = player2?.player_name ?? '';
            const p2Aff = player2?.actual_team_id ? (teamsById.get(player2.actual_team_id) ?? '') : '';

            csvRows.push(
                [
                    escapeCsvValue(repTeamName),
                    escapeCsvValue(regionName),
                    escapeCsvValue(p1Name),
                    escapeCsvValue(p1Aff),
                    escapeCsvValue(p2Name),
                    escapeCsvValue(p2Aff),
                    escapeCsvValue(seedRank),
                ].join(',')
            );
        }

        return new NextResponse(bom + csvHeader + csvRows.join('\n') + '\n', {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="tournament-${id}-entries.csv"`,
            },
        });
    } catch (error) {
        console.error('Export entries error:', error);
        const message = error instanceof Error ? error.message : '不明なエラー';
        return NextResponse.json(
            { error: `CSVエクスポートに失敗しました: ${message}`, code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
