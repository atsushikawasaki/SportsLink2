import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function submitContact(request: Request) {
    try {
        const { category, email, subject, message } = await request.json();

        if (!category || !email || !subject || !message) {
            return NextResponse.json(
                { error: '必須項目を入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        if (message.length < 10) {
            return NextResponse.json(
                { error: '本文は10文字以上で入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // カテゴリのバリデーション
        if (!['technical', 'feature', 'other'].includes(category)) {
            return NextResponse.json(
                { error: '無効な問い合わせ種別です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // ログインユーザーを取得（オプション）
        let userId: string | null = null;
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            userId = user?.id || null;
        } catch {
            // ログインしていない場合はnullのまま
        }

        // 問い合わせ内容をデータベースに保存
        const { data, error: insertError } = await supabase
            .from('contact_requests')
            .insert({
                user_id: userId,
                category,
                email,
                subject,
                message,
                status: 'pending',
            } as never)
            .select()
            .single();

        if (insertError) {
            console.error('Contact request insert error:', insertError);
            // DB保存に失敗してもログには記録
            console.log('Contact form submission (fallback to log):', {
                category,
                email,
                subject,
                message,
                timestamp: new Date().toISOString(),
            });
            return NextResponse.json(
                { error: 'お問い合わせの保存に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: 'お問い合わせを受け付けました。ありがとうございます。',
            id: data.id,
        });
    } catch (error) {
        console.error('Contact form error:', error);
        return NextResponse.json(
            { error: 'お問い合わせの送信に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

