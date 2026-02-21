import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function updatePassword(request: Request) {
    try {
        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: '現在のパスワードと新しいパスワードを入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: '新しいパスワードは8文字以上で入力してください（NIST推奨）', code: 'E-VER-003' },
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

        // Verify current password
        if (userProfile.password_hash) {
            const isValidPassword = await bcrypt.compare(currentPassword, userProfile.password_hash);

            if (!isValidPassword) {
                return NextResponse.json(
                    { error: '現在のパスワードが正しくありません', code: 'E-AUTH-001' },
                    { status: 401 }
                );
            }
        }

        // Update password in Supabase Auth
        const { error: updateAuthError } = await supabase.auth.updateUser({
            password: newPassword,
        });

        if (updateAuthError) {
            return NextResponse.json(
                { error: updateAuthError.message, code: 'E-AUTH-006' },
                { status: 400 }
            );
        }

        // Update password hash in users table
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const { error: dbError } = await supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('id', authUser.id);

        if (dbError) {
            console.error('Password update error:', dbError);
            // Auth password is updated, but users table update failed
            // This is not critical, but log it
        }

        return NextResponse.json({
            message: 'パスワードを変更しました',
        });
    } catch (error) {
        console.error('Password update error:', error);
        return NextResponse.json(
            { error: 'パスワードの変更に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
