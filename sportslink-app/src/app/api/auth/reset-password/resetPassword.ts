import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function resetPassword(request: Request) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { error: 'パスワードを入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'パスワードは6文字以上で入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Verify session (Supabase Auth sets session automatically when user clicks reset link)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData.session) {
            return NextResponse.json(
                { error: '無効または期限切れのリセットリンクです。パスワードリセットメールを再送信してください。', code: 'E-AUTH-005' },
                { status: 401 }
            );
        }

        // Update password in Supabase Auth
        const { error: updateError } = await supabase.auth.updateUser({
            password: password,
        });

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message, code: 'E-AUTH-006' },
                { status: 400 }
            );
        }

        // Update password hash in users table
        const passwordHash = await bcrypt.hash(password, 10);
        const { error: dbError } = await supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('id', sessionData.session.user.id);

        if (dbError) {
            console.error('Password update error:', dbError);
            // Auth password is updated, but users table update failed
            // This is not critical, but log it
        }

        return NextResponse.json({
            message: 'パスワードをリセットしました',
        });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { error: 'パスワードのリセットに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
