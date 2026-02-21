import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { createTeamMatch, propagateWinnerToNextMatch } from '@/lib/services/matchFlowService';

export type UmpireInitial = 'guest' | 'unassigned' | 'me';

/**
 * ブロック内での優先順（両端交互）を返す。
 * @param size ブロックサイズ
 * @param startFirst true=先頭から、false=末尾から
 */
function getOrderWithinBlock(size: number, startFirst: boolean): number[] {
    const order: number[] = [];
    let low = 0;
    let high = size - 1;
    let takeFirst = startFirst;
    while (low <= high) {
        order.push(takeFirst ? low++ : high--);
        takeFirst = !takeFirst;
    }
    return order;
}

/**
 * ソフトテニス標準の配置優先順（シード四隅）を返す。
 * 第1シード: 1番（最上部）、第2シード: N番（最下部）、第3・4シード: 各山の反対側の端（N/4, 3N/4 付近）に固定。
 * 以降、再帰的に山を分割して配置する。
 * @param N 枠数（ブラケットサイズ、2の累乗）
 * @returns 優先順位に対応する枠のインデックス配列（先頭が最優先＝第1シードの枠）
 */
function getPlacementPriority(N: number): number[] {
    if (N <= 1) return Array.from({ length: N }, (_, i) => i);
    if (N === 2) return [0, 1];
    // 四隅: 0, N-1, N/4-1, 3*N/4（1-based で 1, N, N/4, 3N/4+1 に相当）
    const quarter = N / 4;
    const top = [0, N - 1, quarter - 1, 3 * quarter].filter((i) => i >= 0 && i < N);
    const topSet = new Set(top);
    const rest = Array.from({ length: N }, (_, i) => i).filter((i) => !topSet.has(i));
    // 残りを4ブロックに分け、各ブロック内で両端交互の順を付け、ブロック間は 0, 3, 1, 2 の順で取り出す
    const div = 4;
    const blockSize = Math.floor(rest.length / div);
    if (blockSize <= 0) return [...top, ...rest];
    const orderWithin: number[][] = [];
    for (let i = 0; i < div; i++) {
        orderWithin.push(getOrderWithinBlock(blockSize, i % 2 === 0));
    }
    const blockOrder = [0, 3, 1, 2];
    const restOrdered: number[] = [];
    for (let k = 0; k < blockSize; k++) {
        for (const b of blockOrder) {
            if (b * blockSize + orderWithin[b][k] < rest.length) {
                restOrdered.push(rest[b * blockSize + orderWithin[b][k]]);
            }
        }
    }
    const remainder = rest.length - restOrdered.length;
    for (let i = restOrdered.length; i < rest.length; i++) restOrdered.push(rest[i]);
    return [...top, ...restOrdered];
}

/**
 * シード順のブラケット位置を返す（getPlacementPriority に準拠）。
 * 枠数・分割数に応じた一般アルゴリズム。ソフトテニス標準の四隅（1, N, N/4, 3N/4）を優先する。
 */
function getSeedOrder(n: number, _divisions?: number): number[] {
    return getPlacementPriority(n);
}

/**
 * ブラケットサイズ N からデフォルトの分割数を返す。
 * 枠数・BYE 数に応じて変える（N=8→2, N=16→4, N=32→8）。
 */
function getDefaultDivisions(n: number): number {
    if (n <= 8) return 2;
    return Math.max(2, Math.min(Math.floor(n / 4), 8));
}

/** ソフトテニス標準: 四隅のインデックス（1, N, N/4, 3N/4 を 1-based としたときの 0-based） */
function getFourCornerIndices(N: number): number[] {
    if (N <= 4) return [0, N - 1];
    const a = 0;
    const b = N - 1;
    const c = Math.floor(N / 4) - 1; // 1-based N/4 → index
    const d = Math.floor((3 * N) / 4); // 1-based 3N/4 → index (3N/4 番目 = index 3N/4 - 1 の次のイメージで 3N/4 付近)
    const corners = [a, b, Math.min(c, N - 1), Math.min(d, N - 1)];
    return Array.from(new Set(corners)).sort((x, y) => x - y);
}

/**
 * 1回戦で「実戦枠」（パック配置）にするペアのインデックスを返す。
 * 2回戦でシードと当たる位置＝シードの隣の山に1回戦を優先配置する。
 * ペア p は 1回戦で (p, N-1-p) が対戦。2回戦で第1・2シードと当たるのはペア1の勝者、第3・4シードと当たるのはペア2の勝者。
 * @param P 1回戦のペア数（N/2）
 * @param fullPairCount 実戦枠にするペア数（M - P）
 */
function getFullPairIndices(P: number, fullPairCount: number): Set<number> {
    if (fullPairCount <= 0) return new Set();
    // 2回戦でシードと当たるペア: ペア1（第1・2シードの隣）、ペア2（第3・4シードの隣）を優先
    const seedAdjacent = P >= 4 ? [1, 2] : [0, 1].slice(0, Math.min(2, P));
    const seedAdjacentFiltered = seedAdjacent.filter((p) => p < P);
    const rest = Array.from({ length: P }, (_, i) => i).filter((p) => !seedAdjacentFiltered.includes(p));
    const full = [...seedAdjacentFiltered, ...rest].slice(0, fullPairCount);
    return new Set(full);
}

/**
 * ブラケットサイズ N に対する推奨シード数 S の上限を返す。
 * 多すぎると抽選の楽しみが減るため、N に応じた基準を用いる。
 * N=8 (8〜15組) → 4, N=16 (16〜31組) → 8, N=32 → 16, N=64以上 → 16
 */
function getRecommendedSeedCount(bracketSize: number): number {
    if (bracketSize <= 8) return 4;
    if (bracketSize <= 16) return 8;
    if (bracketSize <= 32) return 16;
    return 16;
}

// POST /api/tournaments/:id/draw/generate - ドロー生成
export async function generateDraw(id: string, request?: Request) {
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

        let umpireInitial: UmpireInitial = 'me';
        if (request) {
            try {
                const body = await request.json();
                if (body?.umpire_initial === 'guest' || body?.umpire_initial === 'unassigned' || body?.umpire_initial === 'me') {
                    umpireInitial = body.umpire_initial;
                }
            } catch {
                // body が無い or JSON でない場合はデフォルト 'me' のまま
            }
        }

        const guestUmpireUserId = process.env.GUEST_UMPIRE_USER_ID?.trim() || undefined;
        let umpireId: string | null = authUser.id;
        if (umpireInitial === 'guest') {
            if (!guestUmpireUserId) {
                return NextResponse.json(
                    { error: 'ゲスト審判を利用するには GUEST_UMPIRE_USER_ID の設定が必要です', code: 'E-VER-003' },
                    { status: 400 }
                );
            }
            umpireId = guestUmpireUserId;
        } else if (umpireInitial === 'unassigned') {
            umpireId = null;
        }
        // 'me' のときは umpireId = authUser.id のまま

        const adminClient = createAdminClient();

        // Get tournament to check match_format
        const { data: tournament, error: tournamentError } = await adminClient
            .from('tournaments')
            .select('match_format')
            .eq('id', id)
            .single();

        if (tournamentError || !tournament) {
            return NextResponse.json(
                { error: '大会が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const tournamentRow = tournament as { match_format: string };
        const isTeamMatch = tournamentRow.match_format === 'team_doubles_3' || tournamentRow.match_format === 'team_doubles_4_singles_1';
        const childMatchCount = tournamentRow.match_format === 'team_doubles_3' ? 3 : tournamentRow.match_format === 'team_doubles_4_singles_1' ? 5 : 1;

        // エントリーを取得
        const { data: entries, error: entriesError } = await adminClient
            .from('tournament_entries')
            .select('*')
            .eq('tournament_id', id)
            .eq('is_active', true)
            .order('seed_rank', { ascending: true });

        if (entriesError) {
            return NextResponse.json(
                { error: entriesError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        if (!entries || entries.length === 0) {
            return NextResponse.json(
                { error: 'エントリーがありません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const entriesForBracket = isTeamMatch
            ? entries.filter((e: { entry_type?: string }) => e.entry_type === 'team')
            : entries;
        if (entriesForBracket.length === 0) {
            return NextResponse.json(
                { error: isTeamMatch ? '団体戦のチームエントリーがありません' : 'エントリーがありません', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        if (entriesForBracket.length < 2) {
            return NextResponse.json(
                { error: 'ドロー生成には2組以上のエントリーが必要です。1組のみの場合は対戦相手がいません。', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // 既存のフェーズと試合を削除（必ず実行して重複を防ぐ）
        const { data: existingPhases } = await adminClient
            .from('tournament_phases')
            .select('id')
            .eq('tournament_id', id);

        const phaseIds = (existingPhases ?? []).map((p: { id: string }) => p.id);
        if (phaseIds.length > 0) {
            const { data: existingMatches } = await adminClient
                .from('matches')
                .select('id, status')
                .in('phase_id', phaseIds);
            const inProgressOrFinished = (existingMatches ?? []).filter(
                (m: { status: string }) => m.status === 'inprogress' || m.status === 'finished'
            );
            const hasInProgress = inProgressOrFinished.some((m: { status: string }) => m.status === 'inprogress');
            if (hasInProgress) {
                return NextResponse.json(
                    {
                        error: '試合開始または終了済みの試合があるため、ドローを再生成できません。微修正はスロット編集をご利用ください。',
                        code: 'E-VER-003',
                    },
                    { status: 400 }
                );
            }
            const finishedMatchIds = inProgressOrFinished
                .filter((m: { status: string }) => m.status === 'finished')
                .map((m: { id: string }) => m.id);
            let hasRealFinished = false;
            if (finishedMatchIds.length > 0) {
                const { data: scores } = await adminClient
                    .from('match_scores')
                    .select('match_id, winning_reason')
                    .in('match_id', finishedMatchIds);
                const matchIdToReasons = (scores ?? []).reduce<Record<string, string[]>>((acc, s) => {
                    const mid = (s as { match_id: string; winning_reason: string }).match_id;
                    const reason = (s as { match_id: string; winning_reason: string }).winning_reason;
                    if (!acc[mid]) acc[mid] = [];
                    acc[mid].push(reason);
                    return acc;
                }, {});
                hasRealFinished = finishedMatchIds.some((matchId) => {
                    const reasons = matchIdToReasons[matchId] ?? [];
                    const isBye = reasons.length === 1 && reasons[0] === 'DEFAULT';
                    return !isBye;
                });
            }
            if (hasRealFinished) {
                return NextResponse.json(
                    {
                        error: '試合開始または終了済みの試合があるため、ドローを再生成できません。微修正はスロット編集をご利用ください。',
                        code: 'E-VER-003',
                    },
                    { status: 400 }
                );
            }
            const matchIds = (existingMatches ?? []).map((m: { id: string }) => m.id);
            if (matchIds.length > 0) {
                const { error: slotsByMatchError } = await adminClient
                    .from('match_slots')
                    .delete()
                    .in('match_id', matchIds);
                if (slotsByMatchError) {
                    return NextResponse.json(
                        { error: '既存 match_slots の削除に失敗しました', code: 'E-DB-001', details: slotsByMatchError.message },
                        { status: 500 }
                    );
                }
                const { error: slotsBySourceError } = await adminClient
                    .from('match_slots')
                    .delete()
                    .in('source_match_id', matchIds);
                if (slotsBySourceError) {
                    return NextResponse.json(
                        { error: '既存 match_slots (source) の削除に失敗しました', code: 'E-DB-001', details: slotsBySourceError.message },
                        { status: 500 }
                    );
                }
            }
            const { error: matchesDeleteError } = await adminClient
                .from('matches')
                .delete()
                .in('phase_id', phaseIds);
            if (matchesDeleteError) {
                return NextResponse.json(
                    { error: '既存試合の削除に失敗しました', code: 'E-DB-001', details: matchesDeleteError.message },
                    { status: 500 }
                );
            }
        }
        const { error: phasesDeleteError } = await adminClient
            .from('tournament_phases')
            .delete()
            .eq('tournament_id', id);
        if (phasesDeleteError) {
            return NextResponse.json(
                { error: '既存フェーズの削除に失敗しました', code: 'E-DB-001', details: phasesDeleteError.message },
                { status: 500 }
            );
        }

        // フェーズを作成
        const { data: phase, error: phaseError } = await adminClient
            .from('tournament_phases')
            .insert({
                tournament_id: id,
                phase_type: 'tournament',
                name: 'メイン',
                sequence: 1,
                config: { gamesToWin: 4 },
            })
            .select()
            .single();

        if (phaseError || !phase) {
            return NextResponse.json(
                { error: 'フェーズの作成に失敗しました', code: 'E-DB-001', details: phaseError?.message },
                { status: 500 }
            );
        }

        // ========== 1. 各項目の数の決定（提案アルゴリズム） ==========
        // ① ブラケットサイズ N: 参加組数 M 以上の最小の 2^n
        const M = entriesForBracket.length;
        const N = Math.pow(2, Math.ceil(Math.log2(M)));
        // ② 不戦勝（BYE/脚長）の数 B: ブラケットの空き枠をすべて BYE とする
        const B = N - M;
        // ③ シードの数 S: N に応じた推奨値（抽選の楽しみを考慮）
        const S = getRecommendedSeedCount(N);

        const bracketSize = N;
        const entryCount = M;

        // ========== 2. 配置の優先順位アルゴリズム（再帰的二分法） ==========
        // シードとBYEは「強い選手ほど初戦でBYEになり、互いに決勝まで当たらない」ように配置する。
        // 優先順位表: getSeedOrder(N) で枠の並びを定義し、リストの最後から順に BYE を割り当てる。
        const P = N / 2; // 1回戦のペア数
        const fullPairCount = M - P; // 両方エントリーのペア数（実戦枠）
        const byePairCount = B;     // 1エントリー+1BYEのペア数（B と一致）

        // シードの優先配置: getPlacementPriority(N) で 1, N, N/4付近, 3N/4付近 を最優先に
        const placementOrder = getPlacementPriority(N);
        // パック配置: 1回戦の試合（実参加ペア）をシードの隣（2回戦でシードと当たるペア）に優先配置
        const fullPairIndices = getFullPairIndices(P, fullPairCount);

        const entryPositions: number[] = [];
        for (let p = 0; p < P; p++) {
            if (fullPairIndices.has(p)) {
                entryPositions.push(p, N - 1 - p); // 実戦枠（フルペア）
            } else {
                entryPositions.push(p); // BYE ペア: エントリーは位置 p、BYE は N-1-p
            }
        }

        const entrySet = new Set(entryPositions);
        // シード優先順で並んだ「エントリーが入る枠」の順序（BYE 枠は含めない）
        const entryPositionsInBracketOrder = placementOrder.filter((pos) => entrySet.has(pos));
        const seedOrderForM = getSeedOrder(M);

        type EntryRow = (typeof entriesForBracket)[0];
        const seededEntries: (EntryRow | null)[] = new Array(N).fill(null);
        for (let i = 0; i < M; i++) {
            const bracketPos = entryPositionsInBracketOrder[seedOrderForM[i]];
            seededEntries[bracketPos] = entriesForBracket[i];
        }

        // ラウンド数（1始まり: 1回戦=1, 決勝=roundCount）
        const roundCount = Math.log2(bracketSize);

        const insertedMatches: any[] = [];
        let matchNumber = 1;
        const byeMatchIds: { matchId: string; winnerId: string }[] = [];

        for (let round = 1; round <= roundCount; round++) {
            const matchesInRound = bracketSize / Math.pow(2, round);
            const roundName =
                round === roundCount ? '決勝' : round === roundCount - 1 ? '準決勝' : `${round}回戦`;

            for (let slot = 0; slot < matchesInRound; slot++) {
                const isRound1 = round === 1;
                const entryA = isRound1 ? (seededEntries[slot] ?? null) : null;
                const entryB = isRound1 ? (seededEntries[bracketSize - 1 - slot] ?? null) : null;
                // シード配置により BYE vs BYE は発生しない（各ペアは必ず1以上エントリー）

                const isBye = isRound1 && (entryA == null || entryB == null);
                const byeWinnerEntry = isBye ? (entryA ?? entryB) : null;
                const byeWinnerId =
                    byeWinnerEntry != null
                        ? (byeWinnerEntry.team_id ?? (byeWinnerEntry as { pair_id?: string }).pair_id ?? null)
                        : null;

                const baseMatchData = {
                    tournament_id: id,
                    phase_id: phase.id,
                    round_name: roundName,
                    round_index: round,
                    slot_index: slot,
                    match_number: matchNumber++,
                    ...(umpireId !== null && { umpire_id: umpireId }),
                    ...(umpireId === null && { umpire_id: null }),
                    status: isBye ? 'finished' : 'pending',
                    version: 1,
                };

                if (isTeamMatch) {
                    try {
                        const childMatchesData = Array.from({ length: childMatchCount }, (_, i) => ({
                            ...baseMatchData,
                            round_name: `${roundName} - ${i + 1}試合目`,
                            match_number: matchNumber - 1,
                        }));

                        const { parentMatch } = await createTeamMatch(
                            id,
                            baseMatchData as Parameters<typeof createTeamMatch>[1],
                            childMatchesData as Parameters<typeof createTeamMatch>[2]
                        );

                        if (isBye) {
                            await adminClient
                                .from('matches')
                                .update({ status: 'finished' } as Record<string, unknown>)
                                .eq('id', parentMatch.id);
                        }

                        insertedMatches.push(parentMatch as { id: string; round_index: number; slot_index: number });
                        if (isBye && byeWinnerId) {
                            byeMatchIds.push({ matchId: parentMatch.id, winnerId: byeWinnerId });
                        }
                    } catch (teamMatchError) {
                        console.error('Failed to create team match:', teamMatchError);
                        return NextResponse.json(
                            { error: '団体戦の作成に失敗しました', code: 'E-DB-001' },
                            { status: 500 }
                        );
                    }
                } else {
                    const { data: matchData, error: matchError } = await adminClient
                        .from('matches')
                        .insert({
                            ...baseMatchData,
                            match_type: 'individual_match',
                        } as Record<string, unknown>)
                        .select()
                        .single();

                    if (matchError || !matchData) {
                        return NextResponse.json(
                            { error: '試合の作成に失敗しました', code: 'E-DB-001', details: matchError?.message },
                            { status: 500 }
                        );
                    }

                    const match = matchData as { id: string; round_index: number; slot_index: number };
                    insertedMatches.push(match);

                    if (isBye && byeWinnerId) {
                        byeMatchIds.push({ matchId: match.id, winnerId: byeWinnerId });
                    }
                }
            }
        }

        // BYE試合（足長）: 勝者確定として match_scores を挿入
        for (const { matchId, winnerId } of byeMatchIds) {
            const { error: scoreError } = await adminClient.from('match_scores').insert({
                match_id: matchId,
                game_count_a: 1,
                game_count_b: 0,
                winner_id: winnerId,
                ended_at: new Date().toISOString(),
                winning_reason: 'DEFAULT',
            } as Record<string, unknown>);
            if (scoreError) {
                console.error('BYE match_scores insert error:', scoreError);
            }
        }

        // next_match_id と winner_source_match_a/b を設定
        for (let i = 0; i < insertedMatches.length; i++) {
            const match = insertedMatches[i];
            if (match.round_index === roundCount) continue;

            const nextRound = match.round_index + 1;
            const nextSlot = Math.floor(match.slot_index / 2);
            const nextMatch = insertedMatches.find(
                (m) => m.round_index === nextRound && m.slot_index === nextSlot
            );

            if (nextMatch) {
                const isSlotA = match.slot_index % 2 === 0;
                await adminClient
                    .from('matches')
                    .update({ next_match_id: nextMatch.id } as Record<string, unknown>)
                    .eq('id', match.id);
                await adminClient
                    .from('matches')
                    .update(
                        (isSlotA
                            ? { winner_source_match_a: match.id }
                            : { winner_source_match_b: match.id }) as Record<string, unknown>
                    )
                    .eq('id', nextMatch.id);
            }
        }

        // match_slots: 1回戦は entry/bye、2回戦以降は winner で紐付け
        const round1Matches = insertedMatches.filter((m) => m.round_index === 1);
        for (const match of round1Matches) {
            const slotIndex = match.slot_index as number;
            const entryA = seededEntries[slotIndex] ?? null;
            const entryB = seededEntries[bracketSize - 1 - slotIndex] ?? null;
            const entryIdA = entryA && typeof entryA === 'object' && 'id' in entryA ? (entryA as { id: string }).id : undefined;
            const entryIdB = entryB && typeof entryB === 'object' && 'id' in entryB ? (entryB as { id: string }).id : undefined;

            const slotsToInsert: Array<{
                match_id: string;
                slot_number: number;
                source_type: 'entry' | 'bye';
                entry_id?: string;
                placeholder_label?: string;
            }> = [];
            if (entryIdA) {
                slotsToInsert.push({ match_id: match.id, slot_number: 1, source_type: 'entry', entry_id: entryIdA });
            } else {
                slotsToInsert.push({ match_id: match.id, slot_number: 1, source_type: 'bye', placeholder_label: 'BYE' });
            }
            if (entryIdB) {
                slotsToInsert.push({ match_id: match.id, slot_number: 2, source_type: 'entry', entry_id: entryIdB });
            } else {
                slotsToInsert.push({ match_id: match.id, slot_number: 2, source_type: 'bye', placeholder_label: 'BYE' });
            }

            const { error: slotsError } = await adminClient.from('match_slots').insert(slotsToInsert as Record<string, unknown>[]);
            if (slotsError) {
                console.error('Match slots insert error (round 1):', slotsError.message);
                break;
            }
        }

        const laterMatches = insertedMatches.filter((m) => m.round_index >= 2);
        for (const match of laterMatches) {
            const { data: row } = await adminClient
                .from('matches')
                .select('winner_source_match_a, winner_source_match_b')
                .eq('id', match.id)
                .single();
            const data = row as { winner_source_match_a: string | null; winner_source_match_b: string | null } | null;
            if (!data) continue;

            const slotsToInsert: Array<{
                match_id: string;
                slot_number: number;
                source_type: 'winner';
                source_match_id: string;
            }> = [];
            if (data.winner_source_match_a) {
                slotsToInsert.push({
                    match_id: match.id,
                    slot_number: 1,
                    source_type: 'winner',
                    source_match_id: data.winner_source_match_a,
                });
            }
            if (data.winner_source_match_b) {
                slotsToInsert.push({
                    match_id: match.id,
                    slot_number: 2,
                    source_type: 'winner',
                    source_match_id: data.winner_source_match_b,
                });
            }
            if (slotsToInsert.length > 0) {
                const { error: slotsError } = await adminClient.from('match_slots').insert(slotsToInsert as Record<string, unknown>[]);
                if (slotsError) console.error('Match slots insert error (round 2+):', slotsError.message);
            }
        }

        for (const { matchId, winnerId } of byeMatchIds) {
            try {
                await propagateWinnerToNextMatch(matchId, winnerId);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return NextResponse.json(
                    {
                        error: 'BYE試合の勝者を次ラウンドに反映できませんでした',
                        code: 'E-DB-001',
                        details: message,
                    },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            message: 'ドローを生成しました',
            phase_id: phase.id,
            matches_count: insertedMatches.length,
            bracket_size: N,
            bye_count: B,
            recommended_seed_count: S,
        });
    } catch (error) {
        console.error('Generate draw error:', error);
        const message = error instanceof Error ? error.message : '不明なエラー';
        return NextResponse.json(
            { error: 'ドローの生成に失敗しました', code: 'E-SERVER-001', details: message },
            { status: 500 }
        );
    }
}

