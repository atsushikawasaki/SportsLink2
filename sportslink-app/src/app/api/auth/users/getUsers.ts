import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/permissions';

// GET /api/auth/users - ユーザー一覧取得
export async function getUsers(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');
        const search = searchParams.get('search') || '';

        const supabase = await createClient();

        // Get current user for authentication
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        // Check if user has admin permission (replaces master_flag/master_manager_flag check)
        const hasAdminPermission = await isAdmin(authUser.id);

        if (!hasAdminPermission) {
            return NextResponse.json(
                { error: '権限がありません', code: 'E-RLS-002' },
                { status: 403 }
            );
        }

        // Build query (removed flag columns from select)
        let query = supabase
            .from('users')
            .select('id, email, display_name, created_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Add search filter if provided
        if (search) {
            query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data: users, error, count } = await query;

        if (error) {
            console.error('Get users error:', error);
            return NextResponse.json(
                { error: 'ユーザー一覧の取得に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: users || [],
            count: count || 0,
            limit,
            offset,
        });
    } catch (error) {
        console.error('Get users error:', error);
        return NextResponse.json(
            { error: 'ユーザー一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
