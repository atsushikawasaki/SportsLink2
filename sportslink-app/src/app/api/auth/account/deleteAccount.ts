import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function deleteAccount(request: Request) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { error: 'パスワードを入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Get current user
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        // Get user profile
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

        if (profileError || !userProfile) {
            return NextResponse.json(
                { error: 'ユーザー情報の取得に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // Verify password
        if (userProfile.password_hash) {
            const isValidPassword = await bcrypt.compare(password, userProfile.password_hash);

            if (!isValidPassword) {
                return NextResponse.json(
                    { error: 'パスワードが正しくありません', code: 'E-AUTH-001' },
                    { status: 401 }
                );
            }
        }

        // Delete user from Supabase Auth
        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id);

        if (deleteAuthError) {
            // If admin API is not available, try to delete from users table
            console.warn('Auth user deletion failed, proceeding with database deletion:', deleteAuthError);
        }

        // Delete user profile from users table
        // Note: Related data (tournaments, matches, etc.) should be handled by database triggers or cascade deletes
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', authUser.id);

        if (deleteError) {
            console.error('User deletion error:', deleteError);
            return NextResponse.json(
                { error: 'アカウントの削除に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'アカウントを削除しました',
        });
    } catch (error) {
        console.error('Account deletion error:', error);
        return NextResponse.json(
            { error: 'アカウントの削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

