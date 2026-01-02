import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * 同期前の状態を確認する
 */
export async function checkSyncStatus() {
    // 開発環境でのみ実行可能
    if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_USER_SYNC !== 'true') {
        return NextResponse.json(
            { error: 'This endpoint is only available in development or when ALLOW_USER_SYNC is set' },
            { status: 403 }
        );
    }

    try {
        const adminClient = createAdminClient();

        // auth.usersの一覧を取得
        const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers();
        
        if (authError) {
            return NextResponse.json(
                { error: 'auth.usersの取得に失敗しました', details: authError.message },
                { status: 500 }
            );
        }

        // public.usersの一覧を取得
        const { data: publicUsers, error: publicError } = await adminClient
            .from('users')
            .select('id, email, display_name, created_at')
            .limit(1000);

        if (publicError) {
            return NextResponse.json(
                { error: 'public.usersの取得に失敗しました', details: publicError.message },
                { status: 500 }
            );
        }

        const authUserIds = new Set(authUsers?.users?.map(u => u.id) || []);
        const publicUserIds = new Set(publicUsers?.map(u => u.id) || []);

        // 同期が必要なユーザーを特定
        const missingInPublic = authUsers?.users?.filter(
            u => !publicUserIds.has(u.id)
        ) || [];

        const missingInAuth = publicUsers?.filter(
            u => !authUserIds.has(u.id)
        ) || [];

        return NextResponse.json({
            stats: {
                auth_users_count: authUsers?.users?.length || 0,
                public_users_count: publicUsers?.length || 0,
                missing_in_public: missingInPublic.length,
                missing_in_auth: missingInAuth.length,
            },
            missing_in_public: missingInPublic.map(u => ({
                id: u.id,
                email: u.email,
                created_at: u.created_at,
            })),
            missing_in_auth: missingInAuth.map(u => ({
                id: u.id,
                email: u.email,
                created_at: u.created_at,
            })),
        });
    } catch (error) {
        console.error('User sync check error:', error);
        return NextResponse.json(
            { 
                error: '状態確認中にエラーが発生しました', 
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

