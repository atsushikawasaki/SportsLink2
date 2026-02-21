import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import type { Database } from '@/types/database.types';

type TeamsInsert = Database['public']['Tables']['teams']['Insert'];
type TournamentEntriesInsert = Database['public']['Tables']['tournament_entries']['Insert'];
type TournamentEntriesUpdate = Database['public']['Tables']['tournament_entries']['Update'];
type TournamentPlayersInsert = Database['public']['Tables']['tournament_players']['Insert'];
type TournamentPairsInsert = Database['public']['Tables']['tournament_pairs']['Insert'];

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function removeBom(text: string): string {
    if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
    return text;
}

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

type ImportMode = 'append' | 'update' | 'replace';

export async function importEntries(id: string, request: Request) {
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

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const mode = (formData.get('mode') as ImportMode) || 'append';
        if (!file) {
            return NextResponse.json({ error: 'ファイルが選択されていません', code: 'E-VER-003' }, { status: 400 });
        }

        const text = removeBom(await file.text());
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) {
            return NextResponse.json({ error: 'CSVにヘッダーとデータ行が含まれていません', code: 'E-VER-003' }, { status: 400 });
        }

        const header = parseCsvLine(lines[0]);
        const repTeamIdx = header.findIndex((h) => /代表|チーム/i.test(h));
        const regionIdx = header.findIndex((h) => /地域/i.test(h));
        const p1NameIdx = header.findIndex((h) => /選手1|氏名/i.test(h));
        const p1AffIdx = header.findIndex((h) => /選手1.*所属|所属/i.test(h));
        const p2NameIdx = header.findIndex((h) => /選手2/i.test(h));
        const p2AffIdx = header.findIndex((h) => /選手2.*所属/i.test(h));
        const seedIdx = header.findIndex((h) => /シード/i.test(h));

        const missingColumns: string[] = [];
        if (repTeamIdx === -1) missingColumns.push('代表チーム名');
        if (p1NameIdx === -1) missingColumns.push('選手1氏名');
        if (p1AffIdx === -1) missingColumns.push('選手1所属');
        if (missingColumns.length > 0) {
            return NextResponse.json({
                error: `CSVヘッダーに必須カラムがありません: ${missingColumns.join('、')}。代表チーム名・選手1氏名・選手1所属の列を用意してください。`,
                code: 'E-VER-002',
                header,
                missingColumns,
            }, { status: 400 });
        }

        const validationErrors: Array<{ row: number; message: string }> = [];
        const dataRows: Array<{
            rowNumber: number;
            repTeamName: string;
            regionName: string;
            player1Name: string;
            player1Aff: string;
            player2Name: string;
            player2Aff: string;
            seedRank: number | null;
        }> = [];

        for (let i = 1; i < lines.length; i++) {
            const row = parseCsvLine(lines[i]);
            if (row.length === 0 || row.every((c) => !c.trim())) continue;

            const repTeamName = (repTeamIdx >= 0 ? row[repTeamIdx] : '').trim();
            const regionName = (regionIdx >= 0 ? row[regionIdx] : '').trim();
            const player1Name = (p1NameIdx >= 0 ? row[p1NameIdx] : '').trim();
            const player1Aff = (p1AffIdx >= 0 ? row[p1AffIdx] : '').trim();
            const player2Name = (p2NameIdx >= 0 ? row[p2NameIdx] : '').trim();
            const player2Aff = (p2AffIdx >= 0 ? row[p2AffIdx] : '').trim();
            let seedRank: number | null = null;
            if (seedIdx >= 0 && row[seedIdx]?.trim()) {
                const n = parseInt(row[seedIdx], 10);
                if (Number.isNaN(n)) {
                    validationErrors.push({ row: i + 1, message: 'シードは数値で入力してください' });
                    continue;
                }
                seedRank = n;
            }
            if (!player1Name) {
                validationErrors.push({ row: i + 1, message: '選手1氏名が必須です' });
                continue;
            }
            if (!repTeamName) {
                validationErrors.push({ row: i + 1, message: '代表チーム名が必須です' });
                continue;
            }
            dataRows.push({
                rowNumber: i + 1,
                repTeamName,
                regionName,
                player1Name,
                player1Aff: player1Aff || repTeamName,
                player2Name: player2Name.trim(),
                player2Aff: player2Aff.trim() || repTeamName,
                seedRank,
            });
        }

        if (validationErrors.length > 0) {
            return NextResponse.json({
                error: 'CSVファイルにバリデーションエラーがあります',
                code: 'E-VER-001',
                validationErrors,
            }, { status: 400 });
        }

        type TournamentMatchFormat = { match_format: string };
        const { data: tournamentData, error: tournamentError } = await supabase
            .from('tournaments')
            .select('match_format')
            .eq('id', id)
            .single();
        if (tournamentError || !tournamentData) {
            return NextResponse.json({ error: '大会が見つかりません', code: 'E-NOT-FOUND' }, { status: 404 });
        }
        const tournament = tournamentData as TournamentMatchFormat;
        const isTeamMatch =
            tournament.match_format === 'team_doubles_3' || tournament.match_format === 'team_doubles_4_singles_1';
        const matchFormat = tournament.match_format;

        if (!isTeamMatch) {
            const formatErrors: Array<{ row: number; message: string }> = [];
            if (matchFormat === 'individual_singles') {
                for (const row of dataRows) {
                    if (row.player2Name) {
                        formatErrors.push({
                            row: row.rowNumber,
                            message: '個人シングルスでは選手2は登録できません。選手2の列を空にしてください。',
                        });
                    }
                }
            } else if (matchFormat === 'individual_doubles') {
                for (const row of dataRows) {
                    if (!row.player2Name) {
                        formatErrors.push({ row: row.rowNumber, message: '個人ダブルスでは選手2が必須です。' });
                    }
                }
            }
            if (formatErrors.length > 0) {
                return NextResponse.json({
                    error: 'CSVファイルにバリデーションエラーがあります',
                    code: 'E-VER-001',
                    validationErrors: formatErrors,
                }, { status: 400 });
            }
        }

        const seenKeys = new Set<string>();
        const duplicateErrors: Array<{ row: number; message: string }> = [];
        for (const row of dataRows) {
            const key =
                isTeamMatch
                    ? `${row.repTeamName}\t${row.regionName}`
                    : `${row.repTeamName}\t${row.regionName}\t${row.player1Name}\t${row.player2Name}`;
            if (seenKeys.has(key)) {
                duplicateErrors.push({ row: row.rowNumber, message: '同一のエントリーが重複しています' });
            } else {
                seenKeys.add(key);
            }
        }
        if (duplicateErrors.length > 0) {
            return NextResponse.json({
                error: 'CSVに重複行があります。同一の代表チーム・選手の組み合わせは1行のみにしてください。',
                code: 'E-VER-001',
                validationErrors: duplicateErrors,
            }, { status: 400 });
        }

        const adminClient = createAdminClient();
        const insertedEntryIds: string[] = [];

        const teamsMap = new Map<string, string>();
        const getOrCreateTeam = async (name: string): Promise<string> => {
            const cached = teamsMap.get(name);
            if (cached) return cached;
            const { data: existing } = await adminClient
                .from('teams')
                .select('id')
                .eq('name', name)
                .limit(1);
            if (existing?.length) {
                const existingId = (existing[0] as { id: string }).id;
                teamsMap.set(name, existingId);
                return existingId;
            }
            const teamInsert: TeamsInsert = { name, team_manager_user_id: null };
            const { data: newTeam, error: teamError } = await adminClient
                .from('teams')
                .insert(teamInsert as never)
                .select('id')
                .single();
            if (teamError || !newTeam) throw new Error(`チーム作成失敗: ${teamError?.message || '不明'}`);
            teamsMap.set(name, (newTeam as { id: string }).id);
            return (newTeam as { id: string }).id;
        };

        let importedCount = 0;

        if (isTeamMatch) {
            const uniqueTeams = new Map<string, { repTeamName: string; regionName: string }>();
            for (const row of dataRows) {
                const key = `${row.repTeamName}\t${row.regionName}`;
                if (!uniqueTeams.has(key)) uniqueTeams.set(key, { repTeamName: row.repTeamName, regionName: row.regionName });
            }
            const teamEntryIdByKey = new Map<string, string>();
            for (const { repTeamName, regionName } of Array.from(uniqueTeams.values())) {
                const repTeamId = await getOrCreateTeam(repTeamName);
                const teamEntryInsert: TournamentEntriesInsert = {
                    tournament_id: id,
                    entry_type: 'team',
                    team_id: repTeamId,
                    pair_id: null,
                    seed_rank: null,
                    region_name: regionName || null,
                    custom_display_name: repTeamName,
                    is_active: true,
                };
                const { data: newTeamEntry, error: teamEntryError } = await adminClient
                    .from('tournament_entries')
                    .insert(teamEntryInsert as never)
                    .select('id')
                    .single();
                if (teamEntryError || !newTeamEntry) {
                    throw new Error(`チームエントリー作成失敗: ${teamEntryError?.message || '不明'}`);
                }
                const key = `${repTeamName}\t${regionName}`;
                const eid = (newTeamEntry as { id: string }).id;
                teamEntryIdByKey.set(key, eid);
                insertedEntryIds.push(eid);
            }
            for (const row of dataRows) {
                const key = `${row.repTeamName}\t${row.regionName}`;
                const entryId = teamEntryIdByKey.get(key);
                if (!entryId) continue;
                const actualTeam1Id = await getOrCreateTeam(row.player1Aff);
                const actualTeam2Id = row.player2Name ? await getOrCreateTeam(row.player2Aff) : actualTeam1Id;
                const player1Insert: TournamentPlayersInsert = {
                    entry_id: entryId,
                    actual_team_id: actualTeam1Id,
                    player_name: row.player1Name,
                    player_type: '両方',
                    sort_order: 1,
                };
                const { error: p1Error } = await adminClient
                    .from('tournament_players')
                    .insert(player1Insert as never);
                if (p1Error) throw new Error(`選手1登録失敗 (行${row.rowNumber}): ${p1Error.message}`);
                if (row.player2Name) {
                    const player2Insert: TournamentPlayersInsert = {
                        entry_id: entryId,
                        actual_team_id: actualTeam2Id,
                        player_name: row.player2Name,
                        player_type: '両方',
                        sort_order: 2,
                    };
                    const { error: p2Error } = await adminClient
                        .from('tournament_players')
                        .insert(player2Insert as never);
                    if (p2Error) throw new Error(`選手2登録失敗 (行${row.rowNumber}): ${p2Error.message}`);
                }
            }
            importedCount = uniqueTeams.size;
        } else {
            const entryType = matchFormat === 'individual_doubles' ? 'doubles' : 'singles';
            for (const row of dataRows) {
                const repTeamId = await getOrCreateTeam(row.repTeamName);
                const actualTeam1Id = await getOrCreateTeam(row.player1Aff);
                const actualTeam2Id = row.player2Name ? await getOrCreateTeam(row.player2Aff) : actualTeam1Id;
                const customDisplayName = buildCustomDisplayName(row.player1Name, row.player2Name || null);

                const entryInsert: TournamentEntriesInsert = {
                    tournament_id: id,
                    entry_type: entryType,
                    team_id: repTeamId,
                    pair_id: null,
                    seed_rank: row.seedRank,
                    region_name: row.regionName || null,
                    custom_display_name: customDisplayName,
                    is_active: true,
                };
                const { data: newEntry, error: entryError } = await adminClient
                    .from('tournament_entries')
                    .insert(entryInsert as never)
                    .select('id')
                    .single();
                if (entryError || !newEntry) {
                    throw new Error(`エントリー作成失敗 (行${row.rowNumber}): ${entryError?.message || '不明'}`);
                }

                const entryId = (newEntry as { id: string }).id;
                insertedEntryIds.push(entryId);
                const player1Insert: TournamentPlayersInsert = {
                    entry_id: entryId,
                    actual_team_id: actualTeam1Id,
                    player_name: row.player1Name,
                    player_type: '両方',
                    sort_order: 1,
                };
                const { data: player1, error: p1Error } = await adminClient
                    .from('tournament_players')
                    .insert(player1Insert as never)
                    .select('id')
                    .single();
                if (p1Error || !player1) {
                    throw new Error(`選手1登録失敗 (行${row.rowNumber}): ${p1Error?.message || '不明'}`);
                }

                const player1Id = (player1 as { id: string }).id;
                let player2Id: string | null = null;
                if (row.player2Name) {
                    const player2Insert: TournamentPlayersInsert = {
                        entry_id: entryId,
                        actual_team_id: actualTeam2Id,
                        player_name: row.player2Name,
                        player_type: '両方',
                        sort_order: 2,
                    };
                    const { data: player2, error: p2Error } = await adminClient
                        .from('tournament_players')
                        .insert(player2Insert as never)
                        .select('id')
                        .single();
                    if (p2Error || !player2) {
                        throw new Error(`選手2登録失敗 (行${row.rowNumber}): ${p2Error?.message || '不明'}`);
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
                    throw new Error(`ペア登録失敗 (行${row.rowNumber}): ${pairError?.message || '不明'}`);
                }

                const pairId = (newPair as { id: string }).id;
                const { error: updateEntryError } = await adminClient
                    .from('tournament_entries')
                    .update(({ pair_id: pairId } as TournamentEntriesUpdate) as never)
                    .eq('id', entryId);
                if (updateEntryError) {
                    throw new Error(`エントリー更新失敗 (行${row.rowNumber}): ${updateEntryError.message}`);
                }
                importedCount++;
            }
        }

        if (mode === 'replace' && insertedEntryIds.length > 0) {
            const { data: toDeactivate } = await adminClient
                .from('tournament_entries')
                .select('id')
                .eq('tournament_id', id)
                .eq('is_active', true);
            const idsToDeactivate = (toDeactivate ?? [])
                .map((r: { id: string }) => r.id)
                .filter((eid: string) => !insertedEntryIds.includes(eid));
            for (const eid of idsToDeactivate) {
                await adminClient
                    .from('tournament_entries')
                    .update({ is_active: false } as never)
                    .eq('id', eid);
            }
        }

        return NextResponse.json({
            message: 'CSVインポートが完了しました',
            importedCount,
        });
    } catch (error) {
        console.error('Import entries error:', error);
        const message = error instanceof Error ? error.message : '不明なエラー';
        return NextResponse.json(
            { error: `CSVインポートに失敗しました: ${message}`, code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
