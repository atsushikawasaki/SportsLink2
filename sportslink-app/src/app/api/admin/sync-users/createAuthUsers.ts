import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * public.usersに存在するがauth.usersに存在しないユーザーをauth.usersに作成する
 * 本番で ALLOW_USER_SYNC 時は管理者ロール必須。
 */
export async function createAuthUsers(_request: Request) {
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

        // auth.usersの一覧を取得
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const authUserIds = new Set(authUsers?.users?.map(u => u.id) || []);

        // public.usersに存在するがauth.usersに存在しないユーザーを取得
        const { data: publicUsers, error: publicError } = await adminClient
            .from('users')
            .select('id, email, display_name, password_hash')
            .limit(1000);

        if (publicError) {
            return NextResponse.json(
                { error: 'public.usersの取得に失敗しました', details: publicError.message },
                { status: 500 }
            );
        }

        const missingInAuth = publicUsers?.filter(
            u => !authUserIds.has(u.id)
        ) || [];

        const createdUsers = [];
        const errors = [];

        // 各ユーザーをauth.usersに作成
        for (const user of missingInAuth) {
            try {
                const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
                    email: user.email,
                    email_confirm: true,
                    user_metadata: {
                        display_name: user.display_name || '',
                    },
                    // パスワードが存在する場合は設定しない（後でパスワードリセットが必要）
                });

                if (createError || !newAuthUser.user) {
                    errors.push({
                        user_id: user.id,
                        email: user.email,
                        error: createError?.message || 'Unknown error',
                    });
                    continue;
                }

                // IDが一致しない場合は、public.usersのIDを更新
                if (user.id !== newAuthUser.user.id) {
                    await adminClient
                        .from('users')
                        .update({ id: newAuthUser.user.id })
                        .eq('id', user.id);
                }

                createdUsers.push({
                    old_id: user.id,
                    new_id: newAuthUser.user.id,
                    email: user.email,
                });
            } catch (error) {
                errors.push({
                    user_id: user.id,
                    email: user.email,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return NextResponse.json({
            message: 'auth.usersへのユーザー作成が完了しました',
            stats: {
                total_missing: missingInAuth.length,
                created: createdUsers.length,
                errors: errors.length,
            },
            created_users: createdUsers,
            errors: errors,
        });
    } catch (error) {
        console.error('User creation error:', error);
        return NextResponse.json(
            { 
                error: 'ユーザー作成中にエラーが発生しました', 
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

