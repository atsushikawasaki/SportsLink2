import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { RoleType } from '@/lib/permissions';

// POST /api/roles/assign - 権限付与
export async function assignRole(request: Request) {
    try {
        const body = await request.json();
        const { user_id, role, tournament_id, team_id, match_id } = body;

        if (!user_id || !role) {
            return NextResponse.json(
                { error: 'ユーザーIDとロールは必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Map old role names to new role types
        const roleTypeMap: Record<string, RoleType> = {
            'tournament_admin': 'tournament_admin',
            'scorer': 'umpire',
            'admin': 'admin',
            'team_admin': 'team_admin',
            'umpire': 'umpire',
        };

        const roleType = roleTypeMap[role] as RoleType;
        if (!roleType) {
            return NextResponse.json(
                { error: '有効なロールを指定してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Validate scope based on role type
        if (roleType === 'admin') {
            if (tournament_id || team_id || match_id) {
                return NextResponse.json(
                    { error: 'adminロールはスコープを指定できません', code: 'E-VER-003' },
                    { status: 400 }
                );
            }
        } else if (roleType === 'tournament_admin') {
            if (!tournament_id || team_id || match_id) {
                return NextResponse.json(
                    { error: 'tournament_adminロールはtournament_idが必須で、team_idとmatch_idは指定できません', code: 'E-VER-003' },
                    { status: 400 }
                );
            }
        } else if (roleType === 'team_admin') {
            if (!team_id || tournament_id || match_id) {
                return NextResponse.json(
                    { error: 'team_adminロールはteam_idが必須で、tournament_idとmatch_idは指定できません', code: 'E-VER-003' },
                    { status: 400 }
                );
            }
        } else if (roleType === 'umpire') {
            if (!tournament_id || team_id) {
                return NextResponse.json(
                    { error: 'umpireロールはtournament_idが必須で、team_idは指定できません。match_idはオプションです', code: 'E-VER-003' },
                    { status: 400 }
                );
            }
        }

        const supabase = await createClient();

        // 既存の権限を確認
        let existingQuery = supabase
            .from('user_permissions')
            .select('*')
            .eq('user_id', user_id)
            .eq('role_type', roleType);

        if (tournament_id) {
            existingQuery = existingQuery.eq('tournament_id', tournament_id);
        } else {
            existingQuery = existingQuery.is('tournament_id', null);
        }

        if (team_id) {
            existingQuery = existingQuery.eq('team_id', team_id);
        } else {
            existingQuery = existingQuery.is('team_id', null);
        }

        if (match_id) {
            existingQuery = existingQuery.eq('match_id', match_id);
        } else {
            existingQuery = existingQuery.is('match_id', null);
        }

        const { data: existing } = await existingQuery.single();

        if (existing) {
            return NextResponse.json(
                { error: '既に権限が付与されています', code: 'E-CONFL-001' },
                { status: 409 }
            );
        }

        const { data, error } = await supabase
            .from('user_permissions')
            .insert({
                user_id,
                role_type: roleType,
                tournament_id: tournament_id || null,
                team_id: team_id || null,
                match_id: match_id || null,
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
        console.error('Assign role error:', error);
        return NextResponse.json(
            { error: '権限の付与に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

