import { checkRateLimit } from '@/lib/rateLimit';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function sendPasswordResetEmail(request: Request) {
    try {
        const { allowed, retryAfter } = checkRateLimit(request, 'forgot-password');
        if (!allowed) {
            return NextResponse.json(
                { error: 'リクエストが多すぎます。しばらく経ってからお試しください。', code: 'E-RATE-001' },
                { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
            );
        }

        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'メールアドレスを入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl && process.env.NODE_ENV === 'production') {
            return NextResponse.json(
                { error: 'サーバー設定エラーです。管理者に連絡してください。', code: 'E-SERVER-001' },
                { status: 500 }
            );
        }
        const redirectTo = `${appUrl || 'http://localhost:3000'}/support/reset-password`;

        const supabase = await createClient();

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
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
