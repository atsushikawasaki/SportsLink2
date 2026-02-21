import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * 既存のauth.usersをpublic.usersに同期する
 * 開発環境では誰でも実行可能。本番で ALLOW_USER_SYNC 時は管理者ロール必須。
 */
export async function syncUsers(request: Request) {
    if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_USER_SYNC !== 'true') {
        return NextResponse.json(
            { error: 'This endpoint is only available in development or when ALLOW_USER_SYNC is set' },
            { status: 403 }
        );
    }

    if (process.env.ALLOW_USER_SYNC === 'true') {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }
        if (!(await isAdmin(user.id))) {
            return NextResponse.json(
                { error: '管理者のみ実行できます', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }
    }

    try {
        const adminClient = createAdminClient();

        // 同期前の状態を確認
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const { data: publicUsers } = await adminClient
            .from('users')
            .select('id, email')
            .limit(1000);

        const authUserIds = new Set(authUsers?.users?.map(u => u.id) || []);
        const publicUserIds = new Set(publicUsers?.map(u => u.id) || []);

        const missingInPublic = authUsers?.users?.filter(
            u => !publicUserIds.has(u.id)
        ) || [];

        // 同期関数を実行
        const { data: syncedCount, error: syncError } = await adminClient.rpc('sync_existing_auth_users');

        if (syncError) {
            console.error('Sync error:', syncError);
            return NextResponse.json(
                { 
                    error: '同期に失敗しました', 
                    details: syncError.message,
                    code: 'E-SYNC-001'
                },
                { status: 500 }
            );
        }

        // 同期後の状態を確認
        const { data: publicUsersAfter } = await adminClient
            .from('users')
            .select('id, email')
            .limit(1000);

        return NextResponse.json({
            message: '既存データの同期が完了しました',
            stats: {
                auth_users_count: authUsers?.users?.length || 0,
                public_users_before: publicUsers?.length || 0,
                public_users_after: publicUsersAfter?.length || 0,
                synced_count: syncedCount || 0,
                missing_before: missingInPublic.length,
                missing_users: missingInPublic.map(u => ({
                    id: u.id,
                    email: u.email,
                })),
            },
        });
    } catch (error) {
        console.error('User sync error:', error);
        return NextResponse.json(
            { 
                error: '同期処理中にエラーが発生しました', 
                details: error instanceof Error ? error.message : 'Unknown error',
                code: 'E-SERVER-001'
            },
            { status: 500 }
        );
    }
}

