'use server';

import { createClient } from '@/lib/supabase/server';
import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const assignUmpireSchema = z.object({
    umpire_id: z.string().uuid().nullable(),
});

const updateMatchSchema = z.object({
    round_name: z.string().min(1).optional(),
    round_index: z.number().int().nullable().optional(),
    slot_index: z.number().int().nullable().optional(),
    match_number: z.number().int().nullable().optional(),
    court_number: z.number().int().nullable().optional(),
    status: z.enum(['pending', 'inprogress', 'paused', 'finished']).optional(),
    is_confirmed: z.boolean().nullable().optional(),
}).strict();

async function getMatchTournamentId(matchId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from('matches')
        .select('tournament_id')
        .eq('id', matchId)
        .single();
    return data?.tournament_id ?? null;
}

export async function assignUmpireAction(matchId: string, data: unknown) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const parsed = assignUmpireSchema.parse(data);
    const tournamentId = await getMatchTournamentId(matchId);
    if (!tournamentId) throw new Error('試合が見つかりません');

    const [tournamentAdmin, admin] = await Promise.all([
        isTournamentAdmin(user.id, tournamentId),
        isAdmin(user.id),
    ]);
    if (!tournamentAdmin && !admin) throw new Error('この操作を実行する権限がありません');

    const { data: match } = await supabase
        .from('matches')
        .select('umpire_id')
        .eq('id', matchId)
        .single();

    const { error } = await supabase
        .from('matches')
        .update({ umpire_id: parsed.umpire_id })
        .eq('id', matchId);
    if (error) throw new Error('審判の割り当てに失敗しました');

    const adminClient = createAdminClient();

    if (parsed.umpire_id) {
        const { data: existingPerm } = await adminClient
            .from('user_permissions')
            .select('id')
            .eq('user_id', parsed.umpire_id)
            .eq('role_type', 'umpire')
            .eq('tournament_id', tournamentId)
            .is('match_id', null)
            .maybeSingle();

        if (existingPerm) {
            await adminClient
                .from('user_permissions')
                .update({ match_id: matchId })
                .eq('id', existingPerm.id);
        } else {
            await adminClient.from('user_permissions').insert({
                user_id: parsed.umpire_id,
                role_type: 'umpire',
                tournament_id: tournamentId,
                team_id: null,
                match_id: matchId,
            });
        }
    }

    if (match?.umpire_id && match.umpire_id !== parsed.umpire_id) {
        await adminClient
            .from('user_permissions')
            .update({ match_id: null })
            .eq('user_id', match.umpire_id)
            .eq('role_type', 'umpire')
            .eq('tournament_id', tournamentId)
            .eq('match_id', matchId);
    }

    revalidatePath(`/tournaments/${tournamentId}/assignments`);
}

export async function updateMatchAction(matchId: string, data: unknown) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const parsed = updateMatchSchema.parse(data);
    const tournamentId = await getMatchTournamentId(matchId);
    if (!tournamentId) throw new Error('試合が見つかりません');

    const [umpire, tournamentAdmin, admin] = await Promise.all([
        isUmpire(user.id, tournamentId, matchId),
        isTournamentAdmin(user.id, tournamentId),
        isAdmin(user.id),
    ]);
    if (!umpire && !tournamentAdmin && !admin) throw new Error('この試合を更新する権限がありません');

    const updatePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
        if (v !== undefined) updatePayload[k] = v;
    }

    const { error } = await supabase.from('matches').update(updatePayload).eq('id', matchId);
    if (error) throw new Error('試合の更新に失敗しました');

    revalidatePath(`/tournaments/${tournamentId}/assignments`);
    revalidatePath(`/matches/${matchId}`);
}

export async function confirmMatchAction(matchId: string) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const tournamentId = await getMatchTournamentId(matchId);
    if (!tournamentId) throw new Error('試合が見つかりません');

    const [tournamentAdmin, admin] = await Promise.all([
        isTournamentAdmin(user.id, tournamentId),
        isAdmin(user.id),
    ]);
    if (!tournamentAdmin && !admin) throw new Error('この操作を実行する権限がありません');

    const { error } = await supabase
        .from('matches')
        .update({ is_confirmed: true })
        .eq('id', matchId);
    if (error) throw new Error('試合の確定に失敗しました');

    revalidatePath(`/tournaments/${tournamentId}/results`);
    revalidatePath(`/matches/${matchId}`);
}

export async function generateDrawAction(
    tournamentId: string,
    data: { seed_handling?: string; bye_handling?: string }
) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const [tournamentAdmin, admin] = await Promise.all([
        isTournamentAdmin(user.id, tournamentId),
        isAdmin(user.id),
    ]);
    if (!tournamentAdmin && !admin) throw new Error('この操作を実行する権限がありません');

    const { data: tournament } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', tournamentId)
        .single();
    if (!tournament) throw new Error('大会が見つかりません');
    if (tournament.status === 'finished') throw new Error('終了した大会のドローは生成できません');

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/tournaments/${tournamentId}/draw/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'ドローの生成に失敗しました');
    }

    revalidatePath(`/tournaments/${tournamentId}/draw`);
    return response.json();
}
