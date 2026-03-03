import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { NextResponse } from 'next/server';

// GET /api/auth/me - 現在のユーザープロファイル取得
export async function getCurrentUser(request: Request) {
    const { allowed, retryAfter } = checkRateLimit(request, 'get-me', { maxAttempts: 120 });
    if (!allowed) {
        return NextResponse.json(
            { error: 'リクエストが多すぎます。しばらくしてから再試行してください。', code: 'E-RATE-001' },
            { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
    }

    try {
        const supabase = await createClient();

        // Get current user
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        // Get user profile from users table（0件の場合は profileError にせず null で返る）
        const { data: userProfile } = await supabase
            .from('users')
            .select('id, email, display_name, created_at')
            .eq('id', authUser.id)
            .maybeSingle();

        if (userProfile) {
            return NextResponse.json(userProfile);
        }

        // プロファイルが存在しない場合は認証情報から基本情報を返す
        return NextResponse.json({
            id: authUser.id,
            email: authUser.email || '',
            display_name: authUser.user_metadata?.display_name || '',
            created_at: authUser.created_at || new Date().toISOString(),
        });
    } catch (error) {
        console.error('Get current user error:', error);
        return NextResponse.json(
            { error: 'ユーザー情報の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
