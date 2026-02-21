import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/tournaments/:id/teams - チーム追加（大会管理者または管理者）
export async function addTournamentTeam(id: string, request: Request) {
    try {
        const body = await request.json();
        const { name, team_manager_user_id } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'チーム名は必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const [tournamentAdmin, admin] = await Promise.all([
            isTournamentAdmin(authUser.id, id),
            isAdmin(authUser.id),
        ]);
        if (!tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この大会にチームを追加する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from('teams')
            .insert({
                tournament_id: id,
                name,
                team_manager_user_id,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Create team error:', error);
        return NextResponse.json(
            { error: 'チームの追加に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

