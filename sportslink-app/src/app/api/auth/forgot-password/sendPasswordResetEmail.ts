import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function sendPasswordResetEmail(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'メールアドレスを入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Send password reset email via Supabase Auth
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/support/reset-password`,
        });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-AUTH-004' },
                { status: 400 }
            );
        }

        // Always return success to prevent email enumeration
        return NextResponse.json({
            message: 'パスワードリセットメールを送信しました。メールボックスを確認してください。',
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json(
            { error: 'パスワードリセットメールの送信に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
