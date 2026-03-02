import { isAdmin, isTournamentAdmin, isUmpire } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { processMatchFinish } from '@/lib/services/matchFlowService';

// PUT /api/matches/:id/status - 試合ステータス更新（審判または大会管理者または管理者）
export async function updateMatchStatus(id: string, request: Request) {
    try {
        const body = await request.json();
        const { status } = body;

        if (!status || !['pending', 'inprogress', 'paused', 'finished'].includes(status)) {
            return NextResponse.json(
                { error: '有効なステータスを指定してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('id, status, tournament_id')
            .eq('id', id)
            .single();

        if (matchError || !match) {
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
                { error: 'この試合のステータスを変更する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const updateData: { status: string; started_at?: string } = { status };
        if (status === 'inprogress' && !body.started_at) {
            updateData.started_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('matches')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // If status is 'finished', process match finish with automatic updates
        if (status === 'finished') {
            try {
                await processMatchFinish(id);
            } catch (flowError) {
                console.error('Match flow processing error:', flowError);
                // Continue even if flow processing fails - match is already marked as finished
            }
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Update match status error:', error);
        return NextResponse.json(
            { error: '試合ステータスの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

