import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// DELETE /api/matches/:id/umpire - 審判権限の強制解除（審判または大会管理者または管理者）
export async function removeUmpire(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: matchMeta, error: matchError } = await supabase
            .from('matches')
            .select('tournament_id')
            .eq('id', id)
            .single();
        if (matchError || !matchMeta) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }
        const tournamentId = matchMeta.tournament_id as string;
        const [umpire, tournamentAdmin, admin] = await Promise.all([
            isUmpire(authUser.id, tournamentId, id),
            isTournamentAdmin(authUser.id, tournamentId),
            isAdmin(authUser.id),
        ]);
        if (!umpire && !tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'この試合の審判を解除する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from('matches')
            .update({ umpire_id: null })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: '審判権限を解除しました', data });
    } catch (error) {
        console.error('Remove umpire error:', error);
        return NextResponse.json(
            { error: '審判権限の解除に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

