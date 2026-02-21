import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/matches/:id/confirm - 試合確定（審判または大会管理者または管理者）
export async function confirmMatch(id: string) {
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
            .select('status, tournament_id')
            .eq('id', id)
            .single();

        if (fetchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        const tournamentId = match.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, id),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合を確定する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        if (match.status !== 'finished') {
            return NextResponse.json(
                { error: '終了した試合のみ確定できます', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Set is_confirmed to true
        const { data, error } = await supabase
            .from('matches')
            .update({ is_confirmed: true } as never)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '試合を確定しました', data });
    } catch (error) {
        console.error('Confirm match error:', error);
        return NextResponse.json(
            { error: '試合の確定に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

