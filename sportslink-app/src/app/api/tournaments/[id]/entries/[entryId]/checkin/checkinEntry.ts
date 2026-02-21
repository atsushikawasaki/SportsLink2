import { isTeamAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const DAY_TOKEN_LENGTH = 8;
const MAX_RETRIES = 5;

function generateDayToken(): string {
    const min = Math.pow(10, DAY_TOKEN_LENGTH - 1);
    const max = Math.pow(10, DAY_TOKEN_LENGTH) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

// POST /api/tournaments/:id/entries/:entryId/checkin - 当日受付（大会管理者またはエントリ担当チームの管理者）
export async function checkinEntry(id: string, entryId: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: entry, error: entryError } = await supabase
            .from('tournament_entries')
            .select('id, tournament_id, team_id')
            .eq('id', entryId)
            .eq('tournament_id', id)
            .single();
        if (entryError || !entry) {
            return NextResponse.json(
                { error: 'エントリーが見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const [tournamentAdmin, teamAdmin] = await Promise.all([
            isTournamentAdmin(authUser.id, id),
            entry.team_id ? isTeamAdmin(authUser.id, entry.team_id) : Promise.resolve(false),
        ]);
        let isTeamManager = false;
        if (entry.team_id) {
            const { data: team } = await supabase
                .from('teams')
                .select('team_manager_user_id')
                .eq('id', entry.team_id)
                .single();
            isTeamManager = (team?.team_manager_user_id ?? null) === authUser.id;
        }
        if (!tournamentAdmin && !teamAdmin && !isTeamManager) {
            return NextResponse.json(
                { error: 'このエントリーをチェックインする権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        let dayToken = '';
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            dayToken = generateDayToken();
            const { data: existing } = await supabase
                .from('tournament_entries')
                .select('id')
                .eq('tournament_id', id)
                .eq('day_token', dayToken)
                .neq('id', entryId)
                .maybeSingle();
            if (!existing) break;
        }

        const { data, error } = await supabase
            .from('tournament_entries')
            .update({
                is_checked_in: true,
                day_token: dayToken,
                last_checked_in_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('tournament_id', id)
            .eq('is_checked_in', false)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'すでにチェックイン済みです', code: 'E-VER-003' },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: 'すでにチェックイン済みです', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            ...data,
            day_token: dayToken,
        });
    } catch (error) {
        console.error('Checkin error:', error);
        return NextResponse.json(
            { error: 'チェックインに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

