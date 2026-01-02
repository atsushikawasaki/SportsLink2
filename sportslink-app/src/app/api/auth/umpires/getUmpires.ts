import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/auth/umpires - 審判一覧取得
export async function getUmpires(request: Request) {
    try {
        const supabase = await createClient();

        // Get current user for authentication
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        // Get tournament_id from query parameter
        const { searchParams } = new URL(request.url);
        const tournamentId = searchParams.get('tournament_id');

        if (!tournamentId) {
            return NextResponse.json(
                { error: 'tournament_idパラメータが必要です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Get users with umpire permission for the specified tournament
        // Get user IDs from user_permissions where role_type = 'umpire' and tournament_id matches
        const { data: umpirePermissions, error: permError } = await supabase
            .from('user_permissions')
            .select('user_id')
            .eq('role_type', 'umpire')
            .eq('tournament_id', tournamentId)
            .is('team_id', null);

        if (permError) {
            console.error('Get umpire permissions error:', permError);
            return NextResponse.json(
                { error: '審判一覧の取得に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const umpireUserIds = umpirePermissions?.map(p => p.user_id) || [];

        if (umpireUserIds.length === 0) {
            return NextResponse.json({
                data: [],
                count: 0,
            });
        }

        // Get user details for umpires
        const { data: umpires, error } = await supabase
            .from('users')
            .select('id, email, display_name')
            .in('id', umpireUserIds)
            .order('display_name', { ascending: true });

        if (error) {
            console.error('Get umpires error:', error);
            return NextResponse.json(
                { error: '審判一覧の取得に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: umpires || [],
            count: umpires?.length || 0,
        });
    } catch (error) {
        console.error('Get umpires error:', error);
        return NextResponse.json(
            { error: '審判一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
