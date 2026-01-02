import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function updateProfile(request: Request) {
    try {
        const { displayName } = await request.json();

        if (!displayName) {
            return NextResponse.json(
                { error: '表示名を入力してください', code: 'E-VER-003' },
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

        // Update user profile
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ display_name: displayName })
            .eq('id', authUser.id)
            .select()
            .single();

        if (updateError) {
            console.error('Profile update error:', updateError);
            return NextResponse.json(
                { error: 'プロフィールの更新に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            user: updatedUser,
            message: 'プロフィールを更新しました',
        });
    } catch (error) {
        console.error('Profile update error:', error);
        return NextResponse.json(
            { error: 'プロフィールの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

