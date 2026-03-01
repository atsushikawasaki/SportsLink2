'use server';

import { createClient } from '@/lib/supabase/server';
import { isAdmin, isTeamAdmin } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const createTeamSchema = z.object({
    name: z.string().min(1, 'チーム名は必須です').max(100, 'チーム名は100文字以内で入力してください'),
    team_manager_user_id: z.string().uuid().nullable().optional(),
});

const updateTeamSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    team_manager_user_id: z.string().uuid().nullable().optional(),
}).strict();

const playerSchema = z.object({
    player_name: z.string().min(1, '選手名は必須です').max(100),
    player_number: z.string().max(10).nullable().optional(),
    position: z.string().max(50).nullable().optional(),
});

export async function createTeamAction(data: unknown) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const parsed = createTeamSchema.parse(data);

    let managerId = parsed.team_manager_user_id ?? user.id;
    if (managerId && managerId !== user.id) {
        const admin = await isAdmin(user.id);
        if (!admin) throw new Error('チーム管理者には自分以外を指定できません');
    }

    const { data: team, error } = await supabase
        .from('teams')
        .insert({ name: parsed.name, team_manager_user_id: managerId })
        .select()
        .single();
    if (error) throw new Error('チームの作成に失敗しました');

    revalidatePath('/teams');
    return team;
}

export async function updateTeamAction(id: string, data: unknown) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const parsed = updateTeamSchema.parse(data);

    const [teamAdmin, admin] = await Promise.all([
        isTeamAdmin(user.id, id),
        isAdmin(user.id),
    ]);
    if (!teamAdmin && !admin) throw new Error('このチームを更新する権限がありません');

    const updatePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
        if (v !== undefined) updatePayload[k] = v;
    }
    if (Object.keys(updatePayload).length === 0) throw new Error('更新する項目がありません');

    const { data: team, error } = await supabase
        .from('teams')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error('チームの更新に失敗しました');

    revalidatePath('/teams');
    revalidatePath(`/teams/${id}`);
    return team;
}

export async function deleteTeamAction(id: string) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const [teamAdmin, admin] = await Promise.all([
        isTeamAdmin(user.id, id),
        isAdmin(user.id),
    ]);
    if (!teamAdmin && !admin) throw new Error('このチームを削除する権限がありません');

    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) throw new Error('チームの削除に失敗しました');

    revalidatePath('/teams');
}

export async function addPlayerAction(teamId: string, data: unknown) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const [teamAdmin, admin] = await Promise.all([
        isTeamAdmin(user.id, teamId),
        isAdmin(user.id),
    ]);
    if (!teamAdmin && !admin) throw new Error('この操作を実行する権限がありません');

    const parsed = playerSchema.parse(data);

    const { data: player, error } = await supabase
        .from('team_players')
        .insert({ team_id: teamId, ...parsed })
        .select()
        .single();
    if (error) throw new Error('選手の追加に失敗しました');

    revalidatePath(`/teams/${teamId}`);
    return player;
}

export async function updatePlayerAction(playerId: string, teamId: string, data: unknown) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const [teamAdmin, admin] = await Promise.all([
        isTeamAdmin(user.id, teamId),
        isAdmin(user.id),
    ]);
    if (!teamAdmin && !admin) throw new Error('この操作を実行する権限がありません');

    const parsed = playerSchema.partial().parse(data);

    const { data: player, error } = await supabase
        .from('team_players')
        .update(parsed)
        .eq('id', playerId)
        .select()
        .single();
    if (error) throw new Error('選手の更新に失敗しました');

    revalidatePath(`/teams/${teamId}`);
    return player;
}

export async function deletePlayerAction(playerId: string, teamId: string) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('認証が必要です');

    const [teamAdmin, admin] = await Promise.all([
        isTeamAdmin(user.id, teamId),
        isAdmin(user.id),
    ]);
    if (!teamAdmin && !admin) throw new Error('この操作を実行する権限がありません');

    const { error } = await supabase.from('team_players').delete().eq('id', playerId);
    if (error) throw new Error('選手の削除に失敗しました');

    revalidatePath(`/teams/${teamId}`);
}
