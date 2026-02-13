import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import type { Database } from '@/types/database.types';

type TournamentEntriesInsert = Database['public']['Tables']['tournament_entries']['Insert'];
type TournamentEntriesUpdate = Database['public']['Tables']['tournament_entries']['Update'];
type TournamentPlayersInsert = Database['public']['Tables']['tournament_players']['Insert'];
type TournamentPairsInsert = Database['public']['Tables']['tournament_pairs']['Insert'];

function extractFamilyName(fullName: string): string {
    const trimmed = fullName.trim();
    const spaceIndex = trimmed.search(/\s/);
    if (spaceIndex === -1) return trimmed;
    return trimmed.slice(0, spaceIndex);
}

function buildCustomDisplayName(player1Name: string, player2Name: string | null): string {
    const family1 = extractFamilyName(player1Name);
    if (!player2Name || !player2Name.trim()) return family1;
    const family2 = extractFamilyName(player2Name);
    return `${family1} ・ ${family2}`;
}

type MatchFormat = 'team_doubles_3' | 'team_doubles_4_singles_1' | 'individual_doubles' | 'individual_singles' | null;

function getAllowedEntryType(matchFormat: MatchFormat): 'team' | 'doubles' | 'singles' | null {
    if (matchFormat === 'team_doubles_3' || matchFormat === 'team_doubles_4_singles_1') return 'team';
    if (matchFormat === 'individual_doubles') return 'doubles';
    if (matchFormat === 'individual_singles') return 'singles';
    return null;
}

/**
 * POST /api/tournaments/:id/entries
 * body (team): { entry_type: 'team', team_id, region_name?, seed_rank? }
 * body (pair): { entry_type: 'doubles'|'singles', team_id, region_name?, seed_rank?, player1_name, player1_affiliation, player2_name?, player2_affiliation? }
 * 1大会＝1種類の entry_type。match_format と一致する entry_type のみ許可。
 */
export async function createTournamentEntry(tournamentId: string, request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json({ error: '認証が必要です', code: 'E-AUTH-001' }, { status: 401 });
        }
        const hasPermission = await isAdmin(authUser.id) || await isTournamentAdmin(authUser.id, tournamentId);
        if (!hasPermission) {
            return NextResponse.json({ error: 'この操作を実行する権限がありません', code: 'E-RLS-002' }, { status: 403 });
        }

        const body = await request.json();
        const entryType = body.entry_type as string;

        if (!entryType || !['team', 'doubles', 'singles'].includes(entryType)) {
            return NextResponse.json(
                { error: 'entry_type は team / doubles / singles のいずれかです', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('match_format')
            .eq('id', tournamentId)
            .single();
        if (tournamentError || !tournament) {
            return NextResponse.json({ error: '大会が見つかりません', code: 'E-NOT-FOUND' }, { status: 404 });
        }
        const allowedType = getAllowedEntryType(tournament.match_format as MatchFormat);
        if (allowedType == null) {
            return NextResponse.json(
                { error: '大会の種別（match_format）が設定されていません', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        if (entryType !== allowedType) {
            return NextResponse.json(
                {
                    error: `この大会では entry_type は「${allowedType}」のみ登録できます。現在の種別と一致しません。`,
                    code: 'E-VER-003',
                },
                { status: 400 }
            );
        }

        const adminClient = createAdminClient();

        if (entryType === 'team') {
            const { team_id, region_name, seed_rank } = body;
            if (!team_id) {
                return NextResponse.json(
                    { error: 'team_id は必須です', code: 'E-VER-003' },
                    { status: 400 }
                );
            }

            const { data: team } = await adminClient
                .from('teams')
                .select('id, name')
                .eq('id', team_id)
                .single();
            if (!team) {
                return NextResponse.json({ error: 'チームが見つかりません', code: 'E-NOT-FOUND' }, { status: 404 });
            }

            const entryInsert: TournamentEntriesInsert = {
                tournament_id: tournamentId,
                entry_type: 'team',
                team_id,
                pair_id: null,
                seed_rank: seed_rank != null ? Number(seed_rank) : null,
                region_name: region_name != null ? String(region_name).trim() || null : null,
                custom_display_name: (team as { name: string }).name,
                is_active: true,
            };
            const { data: newEntry, error: entryError } = await adminClient
                .from('tournament_entries')
                .insert(entryInsert as never)
                .select('id')
                .single();

            if (entryError || !newEntry) {
                return NextResponse.json(
                    { error: entryError?.message || 'エントリーの作成に失敗しました', code: 'E-DB-001' },
                    { status: 500 }
                );
            }
            return NextResponse.json({ data: newEntry }, { status: 201 });
        }

        // doubles / singles
        const {
            team_id,
            region_name,
            seed_rank,
            player1_name,
            player1_affiliation,
            player2_name,
            player2_affiliation,
        } = body;

        if (!team_id || !player1_name?.trim()) {
            return NextResponse.json(
                { error: 'team_id と player1_name は必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const isDoubles = entryType === 'doubles';
        if (isDoubles && (!player2_name?.trim() || !player1_affiliation?.trim())) {
            return NextResponse.json(
                { error: 'ダブルスの場合、選手2氏名・選手1所属を入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { data: team } = await adminClient
            .from('teams')
            .select('id')
            .eq('id', team_id)
            .single();
        if (!team) {
            return NextResponse.json({ error: 'チームが見つかりません', code: 'E-NOT-FOUND' }, { status: 404 });
        }

        const p1Aff = (player1_affiliation ?? '').trim() || (team as { name?: string }).name;
        const p2Name = (player2_name ?? '').trim() || null;
        const p2Aff = (player2_affiliation ?? '').trim() || (p2Name ? p1Aff : null);
        const actualTeam2Id = p2Name ? (await resolveTeamId(adminClient, p2Aff)) : (team as { id: string }).id;
        const actualTeam1Id = await resolveTeamId(adminClient, p1Aff);
        const customDisplayName = buildCustomDisplayName(player1_name.trim(), p2Name);

        const entryInsert: TournamentEntriesInsert = {
            tournament_id: tournamentId,
            entry_type: entryType as 'doubles' | 'singles',
            team_id,
            pair_id: null,
            seed_rank: seed_rank != null ? Number(seed_rank) : null,
            region_name: region_name != null ? String(region_name).trim() || null : null,
            custom_display_name: customDisplayName,
            is_active: true,
        };
        const { data: newEntry, error: entryError } = await adminClient
            .from('tournament_entries')
            .insert(entryInsert as never)
            .select('id')
            .single();
        if (entryError || !newEntry) {
            return NextResponse.json(
                { error: entryError?.message || 'エントリーの作成に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }
        const entryId = (newEntry as { id: string }).id;

        const player1Insert: TournamentPlayersInsert = {
            entry_id: entryId,
            actual_team_id: actualTeam1Id,
            player_name: player1_name.trim(),
            player_type: '両方',
            sort_order: 1,
        };
        const { data: player1, error: p1Error } = await adminClient
            .from('tournament_players')
            .insert(player1Insert as never)
            .select('id')
            .single();
        if (p1Error || !player1) {
            return NextResponse.json(
                { error: p1Error?.message || '選手1の登録に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }
        const player1Id = (player1 as { id: string }).id;

        let player2Id: string | null = null;
        if (p2Name) {
            const player2Insert: TournamentPlayersInsert = {
                entry_id: entryId,
                actual_team_id: actualTeam2Id,
                player_name: p2Name,
                player_type: '両方',
                sort_order: 2,
            };
            const { data: player2, error: p2Error } = await adminClient
                .from('tournament_players')
                .insert(player2Insert as never)
                .select('id')
                .single();
            if (p2Error || !player2) {
                return NextResponse.json(
                    { error: p2Error?.message || '選手2の登録に失敗しました', code: 'E-DB-001' },
                    { status: 500 }
                );
            }
            player2Id = (player2 as { id: string }).id;
        }

        const pairInsert: TournamentPairsInsert = {
            entry_id: entryId,
            pair_number: 1,
            player_1_id: player1Id,
            player_2_id: player2Id,
        };
        const { data: newPair, error: pairError } = await adminClient
            .from('tournament_pairs')
            .insert(pairInsert as never)
            .select('id')
            .single();
        if (pairError || !newPair) {
            return NextResponse.json(
                { error: pairError?.message || 'ペアの登録に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }
        const { error: updateEntryError } = await adminClient
            .from('tournament_entries')
            .update(({ pair_id: (newPair as { id: string }).id } as TournamentEntriesUpdate) as never)
            .eq('id', entryId);
        if (updateEntryError) {
            return NextResponse.json(
                { error: updateEntryError.message || 'エントリーの更新に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }
        return NextResponse.json({ data: newEntry }, { status: 201 });
    } catch (error) {
        console.error('Create tournament entry error:', error);
        return NextResponse.json(
            { error: 'エントリーの作成に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

async function resolveTeamId(
    adminClient: ReturnType<typeof createAdminClient>,
    name: string
): Promise<string> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new Error('チーム名が空です');
    const { data: existing } = await adminClient
        .from('teams')
        .select('id')
        .eq('name', trimmed)
        .limit(1);
    if (existing?.length) return (existing[0] as { id: string }).id;
    const { data: newTeam, error } = await adminClient
        .from('teams')
        .insert({ name: trimmed, team_manager_user_id: null } as never)
        .select('id')
        .single();
    if (error || !newTeam) throw new Error(`チーム作成失敗: ${error?.message || '不明'}`);
    return (newTeam as { id: string }).id;
}
