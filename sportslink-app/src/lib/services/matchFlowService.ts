/**
 * Match Flow Service
 * 
 * Handles team match creation, automatic win/loss determination,
 * and automatic progression to next rounds
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type MatchType = 'team_match' | 'individual_match';
export type WinningReason = 'NORMAL' | 'RETIRE' | 'DEFAULT';

interface MatchScore {
    match_id: string;
    game_count_a: number;
    game_count_b: number;
    final_score: string | null;
    winner_id: string | null;
    ended_at: string | null;
    winning_reason: WinningReason | null;
}

interface Match {
    id: string;
    tournament_id: string;
    parent_match_id: string | null;
    match_type: MatchType | null;
    next_match_id: string | null;
    winner_source_match_a: string | null;
    winner_source_match_b: string | null;
    status: 'pending' | 'inprogress' | 'paused' | 'finished';
    round_name: string;
    round_index: number | null;
    slot_index: number | null;
    match_number: number | null;
    umpire_id: string;
}

/**
 * Create team match with child individual matches
 * 
 * @param tournamentId - Tournament ID
 * @param parentMatchData - Parent match data
 * @param childMatchesData - Array of child match data (typically 3 for team_doubles_3)
 * @returns Created parent match and child matches
 */
export async function createTeamMatch(
    tournamentId: string,
    parentMatchData: Partial<Match>,
    childMatchesData: Partial<Match>[]
): Promise<{ parentMatch: Match; childMatches: Match[] }> {
    const supabase = createAdminClient();

    // Start transaction by using a single operation
    // Create parent match first
    const { data: parentMatch, error: parentError } = await supabase
        .from('matches')
        .insert({
            ...parentMatchData,
            tournament_id: tournamentId,
            match_type: 'team_match',
            parent_match_id: null,
            status: 'pending',
        })
        .select()
        .single();

    if (parentError || !parentMatch) {
        throw new Error(`Failed to create parent match: ${parentError?.message || 'Unknown error'}`);
    }

    // Create child matches
    const childMatches: Match[] = [];
    for (const childData of childMatchesData) {
        const { data: childMatch, error: childError } = await supabase
            .from('matches')
            .insert({
                ...childData,
                tournament_id: tournamentId,
                match_type: 'individual_match',
                parent_match_id: parentMatch.id,
                status: 'pending',
            })
            .select()
            .single();

        if (childError || !childMatch) {
            // Rollback: delete parent match if child creation fails
            await supabase.from('matches').delete().eq('id', parentMatch.id);
            throw new Error(`Failed to create child match: ${childError?.message || 'Unknown error'}`);
        }

        childMatches.push(childMatch as Match);
    }

    return { parentMatch: parentMatch as Match, childMatches };
}

/**
 * Determine winner from match scores
 * 
 * @param matchId - Match ID
 * @returns Winner ID (team_id or pair_id) or null if no winner yet
 */
export async function determineMatchWinner(matchId: string): Promise<string | null> {
    const supabase = createAdminClient();

    // Get match scores
    const { data: score, error: scoreError } = await supabase
        .from('match_scores')
        .select('*')
        .eq('match_id', matchId)
        .single();

    if (scoreError || !score) {
        return null;
    }

    // Determine winner based on game_count_a and game_count_b
    if (score.game_count_a > score.game_count_b) {
        // Get match_pairs to find team_id or pair_id for slot A
        const { data: matchPairA } = await supabase
            .from('match_pairs')
            .select('team_id, pair_id')
            .eq('match_id', matchId)
            .eq('pair_number', 1)
            .single();

        return matchPairA?.team_id || matchPairA?.pair_id || null;
    } else if (score.game_count_b > score.game_count_a) {
        const { data: matchPairB } = await supabase
            .from('match_pairs')
            .select('team_id, pair_id')
            .eq('match_id', matchId)
            .eq('pair_number', 2)
            .single();

        return matchPairB?.team_id || matchPairB?.pair_id || null;
    }

    const { data: slots } = await supabase
        .from('match_slots')
        .select('slot_number, source_type, entry_id, source_match_id')
        .eq('match_id', matchId);

    const nonByeSlot = slots?.find((s) => s.source_type !== 'bye');
    if (!nonByeSlot || slots?.length !== 2) {
        return null;
    }

    if (nonByeSlot.entry_id) {
        const { data: entry } = await supabase
            .from('tournament_entries')
            .select('team_id, pair_id')
            .eq('id', nonByeSlot.entry_id)
            .single();
        return entry?.team_id ?? entry?.pair_id ?? null;
    }

    if (nonByeSlot.source_match_id) {
        const winnerId = await determineMatchWinner(nonByeSlot.source_match_id);
        return winnerId;
    }

    return null;
}

/**
 * Update match score with winner information
 * 
 * @param matchId - Match ID
 * @param winnerId - Winner ID (team_id or pair_id)
 * @param winningReason - Reason for winning
 */
export async function updateMatchScoreWithWinner(
    matchId: string,
    winnerId: string,
    winningReason: WinningReason = 'NORMAL'
): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from('match_scores')
        .update({
            winner_id: winnerId,
            ended_at: new Date().toISOString(),
            winning_reason: winningReason,
        })
        .eq('match_id', matchId);

    if (error) {
        throw new Error(`Failed to update match score: ${error.message}`);
    }
}

/**
 * Check if parent team match should be finished
 * 
 * @param parentMatchId - Parent match ID
 * @returns true if parent match should be finished, false otherwise
 */
export async function shouldFinishParentMatch(parentMatchId: string): Promise<boolean> {
    const supabase = createAdminClient();

    // Get all child matches
    const { data: childMatches, error: childError } = await supabase
        .from('matches')
        .select('id, status')
        .eq('parent_match_id', parentMatchId);

    if (childError || !childMatches || childMatches.length === 0) {
        return false;
    }

    // Count wins for each team
    const teamWins: Record<string, number> = {};

    for (const childMatch of childMatches) {
        if (childMatch.status !== 'finished') {
            continue;
        }

        const { data: score } = await supabase
            .from('match_scores')
            .select('winner_id')
            .eq('match_id', childMatch.id)
            .single();

        if (score?.winner_id) {
            teamWins[score.winner_id] = (teamWins[score.winner_id] || 0) + 1;
        }
    }

    // Check if any team has majority wins
    const totalMatches = childMatches.length;
    const majority = Math.ceil(totalMatches / 2);

    for (const [teamId, wins] of Object.entries(teamWins)) {
        if (wins >= majority) {
            return true;
        }
    }

    return false;
}

/**
 * Finish parent team match and determine winner
 * 
 * @param parentMatchId - Parent match ID
 * @returns Winner ID (team_id) or null
 */
export async function finishParentTeamMatch(parentMatchId: string): Promise<string | null> {
    const supabase = createAdminClient();

    // Get all child matches
    const { data: childMatches, error: childError } = await supabase
        .from('matches')
        .select('id, status')
        .eq('parent_match_id', parentMatchId);

    if (childError || !childMatches || childMatches.length === 0) {
        return null;
    }

    // Count wins for each team
    const teamWins: Record<string, number> = {};

    for (const childMatch of childMatches) {
        if (childMatch.status !== 'finished') {
            continue;
        }

        const { data: score } = await supabase
            .from('match_scores')
            .select('winner_id')
            .eq('match_id', childMatch.id)
            .single();

        if (score?.winner_id) {
            teamWins[score.winner_id] = (teamWins[score.winner_id] || 0) + 1;
        }
    }

    const totalMatches = childMatches.length;
    const majority = Math.ceil(totalMatches / 2);
    const allFinished = childMatches.every((m) => m.status === 'finished');

    let winnerId: string | null = null;
    for (const [teamId, wins] of Object.entries(teamWins)) {
        if (wins >= majority) {
            winnerId = teamId;
            break;
        }
    }

    if (allFinished) {
        await supabase
            .from('matches')
            .update({ status: 'finished' })
            .eq('id', parentMatchId);

        const entries = Object.entries(teamWins);
        const winsA = entries[0]?.[1] ?? 0;
        const winsB = entries[1]?.[1] ?? 0;
        const { data: existingScore } = await supabase
            .from('match_scores')
            .select('match_id')
            .eq('match_id', parentMatchId)
            .single();

        if (existingScore) {
            await supabase
                .from('match_scores')
                .update({
                    winner_id: winnerId,
                    ended_at: new Date().toISOString(),
                    winning_reason: winnerId ? 'NORMAL' : null,
                    game_count_a: winsA,
                    game_count_b: winsB,
                })
                .eq('match_id', parentMatchId);
        } else {
            await supabase
                .from('match_scores')
                .insert({
                    match_id: parentMatchId,
                    game_count_a: winsA,
                    game_count_b: winsB,
                    winner_id: winnerId,
                    ended_at: new Date().toISOString(),
                    winning_reason: winnerId ? 'NORMAL' : null,
                });
        }
    }

    return winnerId;
}

/**
 * Propagate winner to next match
 * 
 * @param matchId - Finished match ID
 * @param winnerId - Winner ID (team_id or pair_id)
 */
export async function propagateWinnerToNextMatch(
    matchId: string,
    winnerId: string
): Promise<void> {
    const supabase = createAdminClient();

    // Get match to find next_match_id
    const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('next_match_id, winner_source_match_a, winner_source_match_b')
        .eq('id', matchId)
        .single();

    if (matchError || !match || !match.next_match_id) {
        return; // No next match
    }

    // Determine which slot (A or B) to fill
    let slotNumber: number;
    if (match.winner_source_match_a === matchId) {
        slotNumber = 1; // Slot A
    } else if (match.winner_source_match_b === matchId) {
        slotNumber = 2; // Slot B
    } else {
        // Default: use slot_index or round_index to determine
        const { data: currentMatch } = await supabase
            .from('matches')
            .select('slot_index, round_index')
            .eq('id', matchId)
            .single();

        const { data: nextMatch } = await supabase
            .from('matches')
            .select('slot_index, round_index')
            .eq('id', match.next_match_id)
            .single();

        if (currentMatch && nextMatch) {
            // Determine slot based on position
            slotNumber = (currentMatch.slot_index || 0) % 2 === 0 ? 1 : 2;
        } else {
            slotNumber = 1; // Default to slot A
        }
    }

        // Check if match_pair already exists
    const { data: existingPair } = await supabase
        .from('match_pairs')
        .select('id, team_id, player_1_id, player_2_id')
        .eq('match_id', match.next_match_id)
        .eq('pair_number', slotNumber)
        .single();

    const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('id', winnerId)
        .single();

    const isTeam = !!team;

    let winningSlotPlayer1: string | null = null;
    let winningSlotPlayer2: string | null = null;
    const { data: score } = await supabase
        .from('match_scores')
        .select('game_count_a, game_count_b')
        .eq('match_id', matchId)
        .single();
    if (score) {
        const winnerSlot = score.game_count_a > score.game_count_b ? 1 : 2;
        const { data: winnerMatchPair } = await supabase
            .from('match_pairs')
            .select('player_1_id, player_2_id')
            .eq('match_id', matchId)
            .eq('pair_number', winnerSlot)
            .maybeSingle();
        if (winnerMatchPair) {
            winningSlotPlayer1 = winnerMatchPair.player_1_id;
            winningSlotPlayer2 = winnerMatchPair.player_2_id ?? null;
        }
    }

    const resolveTournamentPairForTeam = async (): Promise<{ player_1_id: string; player_2_id: string | null } | null> => {
        const { data: entries } = await supabase
            .from('tournament_entries')
            .select('id')
            .eq('team_id', winnerId)
            .eq('is_active', true);
        const entryIds = (entries ?? []).map((e: { id: string }) => e.id);
        if (entryIds.length === 0) return null;

        if (winningSlotPlayer1) {
            let q = supabase
                .from('tournament_pairs')
                .select('player_1_id, player_2_id')
                .in('entry_id', entryIds)
                .eq('player_1_id', winningSlotPlayer1);
            if (winningSlotPlayer2 != null) {
                q = q.eq('player_2_id', winningSlotPlayer2);
            } else {
                q = q.is('player_2_id', null);
            }
            const { data: tp } = await q.maybeSingle();
            if (tp) return tp;
            const { data: first } = await supabase
                .from('tournament_pairs')
                .select('player_1_id, player_2_id')
                .in('entry_id', entryIds)
                .eq('player_1_id', winningSlotPlayer1)
                .limit(1)
                .maybeSingle();
            if (first) return first;
        }
        const { data: fallback } = await supabase
            .from('tournament_pairs')
            .select('player_1_id, player_2_id')
            .in('entry_id', entryIds)
            .limit(1)
            .maybeSingle();
        return fallback;
    };

    if (existingPair) {
        if (isTeam) {
            const tournamentPair = await resolveTournamentPairForTeam();
            const updateData: any = { team_id: winnerId };
            if (tournamentPair) {
                updateData.player_1_id = tournamentPair.player_1_id;
                updateData.player_2_id = tournamentPair.player_2_id;
            }
            await supabase
                .from('match_pairs')
                .update(updateData)
                .eq('id', existingPair.id);
        } else {
            // For pairs, get player IDs from tournament_pairs
            const { data: tournamentPair } = await supabase
                .from('tournament_pairs')
                .select('player_1_id, player_2_id, team_id')
                .eq('id', winnerId)
                .single();

            if (tournamentPair) {
                await supabase
                    .from('match_pairs')
                    .update({
                        team_id: tournamentPair.team_id,
                        player_1_id: tournamentPair.player_1_id,
                        player_2_id: tournamentPair.player_2_id,
                    })
                    .eq('id', existingPair.id);
            }
        }
    } else {
        const pairData: any = {
            match_id: match.next_match_id,
            pair_number: slotNumber,
        };

        if (isTeam) {
            pairData.team_id = winnerId;
            const tournamentPair = await resolveTournamentPairForTeam();
            if (tournamentPair) {
                pairData.player_1_id = tournamentPair.player_1_id;
                pairData.player_2_id = tournamentPair.player_2_id;
            }
        } else {
            // For individual matches, get player IDs from tournament_pairs
            const { data: tournamentPair } = await supabase
                .from('tournament_pairs')
                .select('player_1_id, player_2_id, team_id')
                .eq('id', winnerId)
                .single();

            if (tournamentPair) {
                pairData.team_id = tournamentPair.team_id;
                pairData.player_1_id = tournamentPair.player_1_id;
                pairData.player_2_id = tournamentPair.player_2_id;
            }
        }

        await supabase
            .from('match_pairs')
            .insert(pairData);
    }
}

/**
 * Process match finish - handles all automatic updates
 * 
 * @param matchId - Finished match ID
 */
export async function processMatchFinish(matchId: string): Promise<void> {
    const supabase = createAdminClient();

    // Get match information
    const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

    if (matchError || !match) {
        throw new Error(`Match not found: ${matchId}`);
    }

    // Determine winner
    const winnerId = await determineMatchWinner(matchId);
    if (!winnerId) {
        throw new Error(`Could not determine winner for match: ${matchId}`);
    }

    // Update match score with winner
    await updateMatchScoreWithWinner(matchId, winnerId, 'NORMAL');

    if (match.parent_match_id) {
        const parentWinnerId = await finishParentTeamMatch(match.parent_match_id);
        if (parentWinnerId) {
            await propagateWinnerToNextMatch(match.parent_match_id, parentWinnerId);
        }
    } else {
        // This is a standalone match or parent match, propagate winner
        await propagateWinnerToNextMatch(matchId, winnerId);
    }
}

