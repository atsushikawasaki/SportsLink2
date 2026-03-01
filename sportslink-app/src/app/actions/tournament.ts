'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createTournamentSchema = z.object({
    name: z.string().min(1, '大会名は必須です').max(200, '大会名は200文字以内で入力してください'),
    description: z.string().nullable().optional(),
    is_public: z.boolean().optional().default(false),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    match_format: z
        .enum(['team_doubles_3', 'team_doubles_4_singles_1', 'individual_doubles', 'individual_singles'])
        .nullable()
        .optional(),
    umpire_mode: z.enum(['LOSER', 'ASSIGNED', 'FREE']).optional().default('LOSER'),
});

const updateTournamentSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: z.enum(['draft', 'published', 'finished']).optional(),
    is_public: z.boolean().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    match_format: z
        .enum(['team_doubles_3', 'team_doubles_4_singles_1', 'individual_doubles', 'individual_singles'])
        .nullable()
        .optional(),
    umpire_mode: z.enum(['LOSER', 'ASSIGNED', 'FREE']).optional(),
}).strict();

export async function createTournamentAction(data: unknown) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const parsed = createTournamentSchema.parse(data);

    if (parsed.start_date && parsed.end_date && new Date(parsed.start_date) > new Date(parsed.end_date)) {
        throw new Error('終了日は開始日以降にしてください');
    }

    const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
            name: parsed.name,
            description: parsed.description ?? null,
            status: 'draft',
            is_public: parsed.is_public ?? false,
            start_date: parsed.start_date ?? null,
            end_date: parsed.end_date ?? null,
            match_format: parsed.match_format ?? null,
            umpire_mode: parsed.umpire_mode ?? 'LOSER',
            created_by_user_id: user.id,
        })
        .select()
        .single();

    if (error) throw new Error('大会の作成に失敗しました');

    const { error: permError } = await supabase.from('user_permissions').insert({
        user_id: user.id,
        role_type: 'tournament_admin',
        tournament_id: tournament.id,
        team_id: null,
        match_id: null,
    });

    if (permError) {
        await supabase.from('tournaments').delete().eq('id', tournament.id);
        throw new Error('大会の作成に失敗しました（権限設定エラー）');
    }

    revalidatePath('/tournaments');
    return tournament;
}

export async function updateTournamentAction(id: string, data: unknown) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const parsed = updateTournamentSchema.parse(data);

    const { data: tournament, error: fetchError } = await supabase
        .from('tournaments')
        .select('id, created_by_user_id')
        .eq('id', id)
        .single();
    if (fetchError || !tournament) throw new Error('大会が見つかりません');

    const [tournamentAdmin, admin] = await Promise.all([
        isTournamentAdmin(user.id, id),
        isAdmin(user.id),
    ]);
    const isCreator = tournament.created_by_user_id === user.id;
    if (!tournamentAdmin && !admin && !isCreator) throw new Error('この大会を更新する権限がありません');

    const updatePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
        if (v !== undefined) updatePayload[k] = v;
    }
    if (Object.keys(updatePayload).length === 0) throw new Error('更新する項目がありません');

    const { data: updated, error } = await supabase
        .from('tournaments')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error('大会の更新に失敗しました');

    revalidatePath(`/tournaments/${id}`);
    revalidatePath('/tournaments');
    return updated;
}

export async function publishTournamentAction(id: string) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const { data: tournament, error: fetchError } = await supabase
        .from('tournaments')
        .select('id, status, created_by_user_id')
        .eq('id', id)
        .single();
    if (fetchError || !tournament) throw new Error('大会が見つかりません');

    const [tournamentAdmin, admin] = await Promise.all([
        isTournamentAdmin(user.id, id),
        isAdmin(user.id),
    ]);
    const isCreator = tournament.created_by_user_id === user.id;
    if (!tournamentAdmin && !admin && !isCreator) throw new Error('この大会を公開する権限がありません');

    if (tournament.status !== 'draft') throw new Error('下書きの大会のみ公開できます');

    const { count } = await supabase
        .from('tournament_entries')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', id)
        .eq('is_active', true);
    if ((count ?? 0) === 0) throw new Error('エントリーが1件以上必要です');

    const { data: updated, error } = await supabase
        .from('tournaments')
        .update({ status: 'published', is_public: true })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error('大会の公開に失敗しました');

    revalidatePath(`/tournaments/${id}`);
    revalidatePath('/tournaments');
    return updated;
}

export async function finishTournamentAction(id: string) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const { data: tournament, error: fetchError } = await supabase
        .from('tournaments')
        .select('id, status, created_by_user_id')
        .eq('id', id)
        .single();
    if (fetchError || !tournament) throw new Error('大会が見つかりません');

    const [tournamentAdmin, admin] = await Promise.all([
        isTournamentAdmin(user.id, id),
        isAdmin(user.id),
    ]);
    const isCreator = tournament.created_by_user_id === user.id;
    if (!tournamentAdmin && !admin && !isCreator) throw new Error('この大会を終了する権限がありません');

    if (tournament.status !== 'published') throw new Error('公開中の大会のみ終了できます');

    const { data: updated, error } = await supabase
        .from('tournaments')
        .update({ status: 'finished' })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error('大会の終了に失敗しました');

    revalidatePath(`/tournaments/${id}`);
    revalidatePath('/tournaments');
    return updated;
}

export async function deleteTournamentAction(id: string) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const { data: tournament, error: fetchError } = await supabase
        .from('tournaments')
        .select('id, status, created_by_user_id')
        .eq('id', id)
        .single();
    if (fetchError || !tournament) throw new Error('大会が見つかりません');

    const [tournamentAdmin, admin] = await Promise.all([
        isTournamentAdmin(user.id, id),
        isAdmin(user.id),
    ]);
    const isCreator = tournament.created_by_user_id === user.id;
    if (!tournamentAdmin && !admin && !isCreator) throw new Error('この大会を削除する権限がありません');

    if (tournament.status !== 'draft') throw new Error('下書きの大会のみ削除できます');

    const adminClient = createAdminClient();
    await adminClient.from('user_permissions').delete().eq('tournament_id', id);

    const { error } = await supabase.from('tournaments').delete().eq('id', id);
    if (error) throw new Error('大会の削除に失敗しました');

    revalidatePath('/tournaments');
}
