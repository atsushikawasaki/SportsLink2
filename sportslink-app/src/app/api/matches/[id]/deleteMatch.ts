import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/matches/:id - 試合削除（大会管理者または管理者）
export async function deleteMatch(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: match, error: fetchError } = await supabase
            .from('matches')
            .select('tournament_id, status')
            .eq('id', id)
            .single();
        if (fetchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const tournamentId = match.tournament_id as string;
        const [tournamentAdmin, admin] = await Promise.all([
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合を削除する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        if (match.status === 'inprogress' || match.status === 'finished') {
            return NextResponse.json(
                { error: '進行中または終了済みの試合は削除できません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '試合を削除しました' });
    } catch (error) {
        console.error('Delete match error:', error);
        return NextResponse.json(
            { error: '試合の削除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

