import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createTeamMatch } from '@/lib/services/matchFlowService';

// POST /api/tournaments/:id/draw/generate - ドロー生成
export async function generateDraw(id: string) {
    try {
        const supabase = await createClient();

        // Get tournament to check match_format
        const { data: tournament, error: tournamentError } = await supabase
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

        const isTeamMatch = tournament.match_format === 'team_doubles_3' || tournament.match_format === 'team_doubles_4_singles_1';
        const childMatchCount = tournament.match_format === 'team_doubles_3' ? 3 : tournament.match_format === 'team_doubles_4_singles_1' ? 5 : 1;

        // エントリーを取得
        const { data: entries, error: entriesError } = await supabase
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

        // 既存のフェーズと試合を削除
        const { data: existingPhases } = await supabase
            .from('tournament_phases')
            .select('id')
            .eq('tournament_id', id);

        if (existingPhases && existingPhases.length > 0) {
            const phaseIds = existingPhases.map((p) => p.id);
            await supabase.from('matches').delete().in('phase_id', phaseIds);
            await supabase.from('tournament_phases').delete().eq('tournament_id', id);
        }

        // フェーズを作成
        const { data: phase, error: phaseError } = await supabase
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
                { error: 'フェーズの作成に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // ブラケットサイズを計算（2の累乗）
        const entryCount = entries.length;
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(entryCount)));

        // ラウンド数を計算
        const roundCount = Math.log2(bracketSize);

        // 試合を作成
        const insertedMatches: any[] = [];
        let matchNumber = 1;

        for (let round = 0; round < roundCount; round++) {
            const matchesInRound = bracketSize / Math.pow(2, round + 1);
            const roundName = round === roundCount - 1 ? '決勝' : round === roundCount - 2 ? '準決勝' : `${roundCount - round}回戦`;

            for (let slot = 0; slot < matchesInRound; slot++) {
                const baseMatchData = {
                    tournament_id: id,
                    phase_id: phase.id,
                    round_name: roundName,
                    round_index: round,
                    slot_index: slot,
                    match_number: matchNumber++,
                    umpire_id: '00000000-0000-0000-0000-000000000000', // Temporary placeholder, will be updated later
                    status: 'pending' as const,
                    version: 1,
                };

                if (isTeamMatch) {
                    // Create team match with child matches
                    try {
                        const childMatchesData = Array.from({ length: childMatchCount }, (_, i) => ({
                            ...baseMatchData,
                            round_name: `${roundName} - ${i + 1}試合目`,
                            match_number: matchNumber - 1, // Same match number for all children
                        }));

                        const { parentMatch, childMatches } = await createTeamMatch(
                            id,
                            baseMatchData,
                            childMatchesData
                        );

                        insertedMatches.push(parentMatch);
                        // Note: childMatches are already created, but we track parent only for now
                    } catch (teamMatchError) {
                        console.error('Failed to create team match:', teamMatchError);
                        return NextResponse.json(
                            { error: '団体戦の作成に失敗しました', code: 'E-DB-001' },
                            { status: 500 }
                        );
                    }
                } else {
                    // Create individual match
                    const { data: match, error: matchError } = await supabase
                        .from('matches')
                        .insert({
                            ...baseMatchData,
                            match_type: 'individual_match',
                        })
                        .select()
                        .single();

                    if (matchError || !match) {
                        return NextResponse.json(
                            { error: '試合の作成に失敗しました', code: 'E-DB-001' },
                            { status: 500 }
                        );
                    }

                    insertedMatches.push(match);
                }
            }
        }

        // Set next_match_id and winner_source_match_a/b for match progression
        for (let i = 0; i < insertedMatches.length; i++) {
            const match = insertedMatches[i];
            
            // Skip if this is the final match
            if (match.round_index === roundCount - 1) {
                continue;
            }

            // Find next match in the bracket
            const nextRound = match.round_index! + 1;
            const nextSlot = Math.floor(match.slot_index! / 2);
            const nextMatch = insertedMatches.find(
                (m) => m.round_index === nextRound && m.slot_index === nextSlot
            );

            if (nextMatch) {
                // Determine which slot (A or B) this match feeds into
                const isSlotA = match.slot_index! % 2 === 0;

                // Update current match with next_match_id
                await supabase
                    .from('matches')
                    .update({ next_match_id: nextMatch.id })
                    .eq('id', match.id);

                // Update next match with winner_source_match_a or winner_source_match_b
                const updateData: any = {};
                if (isSlotA) {
                    updateData.winner_source_match_a = match.id;
                } else {
                    updateData.winner_source_match_b = match.id;
                }

                await supabase
                    .from('matches')
                    .update(updateData)
                    .eq('id', nextMatch.id);
            }
        }

        return NextResponse.json({
            message: 'ドローを生成しました',
            phase_id: phase.id,
            matches_count: insertedMatches.length,
        });
    } catch (error) {
        console.error('Generate draw error:', error);
        return NextResponse.json(
            { error: 'ドローの生成に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

