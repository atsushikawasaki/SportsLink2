import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/tournaments - 大会作成
export async function createTournament(request: Request) {
    try {
        const body = await request.json();
        const { name, description, status, is_public, start_date, end_date, match_format, umpire_mode } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json(
                { error: '大会名は必須です', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        if (name.length > 200) {
            return NextResponse.json(
                { error: '大会名は200文字以内で入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }
        if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
            return NextResponse.json(
                { error: '終了日は開始日以降にしてください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'ログインが必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data, error } = await supabase
            .from('tournaments')
            .insert({
                name,
                description,
                status: status || 'draft',
                is_public: is_public || false,
                start_date,
                end_date,
                match_format,
                umpire_mode: umpire_mode || 'LOSER',
                created_by_user_id: user.id,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // Add tournament_admin permission for creator
        const { error: permError } = await supabase.from('user_permissions').insert({
            user_id: user.id,
            role_type: 'tournament_admin',
            tournament_id: data.id,
            team_id: null,
            match_id: null,
        });
        if (permError) {
            console.error('Failed to create tournament_admin permission:', permError);
            // Clean up: delete the tournament if permission creation fails
            await supabase.from('tournaments').delete().eq('id', data.id);
            return NextResponse.json(
                { error: '大会の作成に失敗しました（権限設定エラー）', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Create tournament error:', error);
        return NextResponse.json(
            { error: '大会の作成に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

