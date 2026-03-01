import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// PUT /api/matches/:id/assign - 試合割当（審判・コート）（審判または大会管理者または管理者）
export async function assignMatch(id: string, request: Request) {
    try {
        const body = await request.json();
        const { umpire_id, court_number } = body;

        if (
            court_number !== undefined &&
            court_number !== null &&
            (!Number.isInteger(court_number) || court_number < 1)
        ) {
            return NextResponse.json(
                { error: 'コート番号は1以上の正の整数のみ指定できます', code: 'E-VER-003' },
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

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('tournament_id, umpire_id, status')
            .eq('id', id)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (match.status === 'finished') {
            return NextResponse.json(
                { error: '終了した試合の割当は変更できません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const tournamentId = match.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, id),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合の割当を変更する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const updateData: Record<string, unknown> = {};
        if (umpire_id !== undefined) updateData.umpire_id = umpire_id;
        if (court_number !== undefined) updateData.court_number = court_number;

        const { data, error } = await supabase
            .from('matches')
            .update(updateData as never)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // If umpire_id is being assigned, update user_permissions
        if (umpire_id && umpire_id !== match.umpire_id) {
            const adminSupabase = createAdminClient();
            
            // Find existing umpire permission for this tournament (match_id is NULL)
            const { data: existingPermission } = await adminSupabase
                .from('user_permissions')
                .select('id')
                .eq('user_id', umpire_id)
                .eq('role_type', 'umpire')
                .eq('tournament_id', match.tournament_id)
                .is('match_id', null)
                .maybeSingle();

            if (existingPermission) {
                // Update existing permission to include match_id
                await adminSupabase
                    .from('user_permissions')
                    .update({ match_id: id })
                    .eq('id', existingPermission.id);
            } else {
                // Create new permission if it doesn't exist
                await adminSupabase
                    .from('user_permissions')
                    .insert({
                        user_id: umpire_id,
                        role_type: 'umpire',
                        tournament_id: match.tournament_id,
                        team_id: null,
                        match_id: id,
                    });
            }

            // If previous umpire was assigned, remove match_id from their permission
            if (match.umpire_id && match.umpire_id !== umpire_id) {
                await adminSupabase
                    .from('user_permissions')
                    .update({ match_id: null })
                    .eq('user_id', match.umpire_id)
                    .eq('role_type', 'umpire')
                    .eq('tournament_id', match.tournament_id)
                    .eq('match_id', id);
            }
        } else if (umpire_id === null && match.umpire_id) {
            // If umpire is being removed, set match_id to NULL but keep tournament permission
            const adminSupabase = createAdminClient();
            await adminSupabase
                .from('user_permissions')
                .update({ match_id: null })
                .eq('user_id', match.umpire_id)
                .eq('role_type', 'umpire')
                .eq('tournament_id', match.tournament_id)
                .eq('match_id', id);
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Assign match error:', error);
        return NextResponse.json(
            { error: '試合の割当に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

