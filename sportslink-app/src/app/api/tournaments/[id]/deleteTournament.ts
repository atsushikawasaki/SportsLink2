import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/tournaments/:id - 大会削除（大会管理者または管理者または作成者）
export async function deleteTournament(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: tournament, error: fetchError } = await supabase
            .from('tournaments')
            .select('id, status, created_by_user_id')
            .eq('id', id)
            .single();
        if (fetchError || !tournament) {
            return NextResponse.json(
                { error: '大会が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const [tournamentAdmin, admin] = await Promise.all([
            isTournamentAdmin(authUser.id, id),
            isAdmin(authUser.id),
        ]);
        const isCreator = (tournament as { created_by_user_id?: string }).created_by_user_id === authUser.id;
        if (!tournamentAdmin && !admin && !isCreator) {
            return NextResponse.json(
                { error: 'この大会を削除する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        if ((tournament as { status: string }).status === 'published') {
            return NextResponse.json(
                { error: '公開済みの大会は削除できません。先に大会を終了してください。', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '大会を削除しました' });
    } catch (error) {
        console.error('Delete tournament error:', error);
        return NextResponse.json(
            { error: '大会の削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

