import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/tournaments/:id/draw - ドロー更新（大会管理者または管理者）
export async function updateDraw(id: string, request: Request) {
    try {
        const body = await request.json();
        const { matches } = body; // matches: Array<{ id, umpire_id, court_number, ... }>

        if (!Array.isArray(matches)) {
            return NextResponse.json(
                { error: '試合データが必要です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const invalidCourt = matches.some(
            (m: { court_number?: number | null }) =>
                m.court_number != null &&
                (!Number.isInteger(m.court_number) || (m.court_number as number) < 1)
        );
        if (invalidCourt) {
            return NextResponse.json(
                { error: 'コート番号は1以上の正の整数のみ指定できます', code: 'E-VER-003' },
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

        const [tournamentAdmin, admin] = await Promise.all([
            isTournamentAdmin(authUser.id, id),
            isAdmin(authUser.id),
        ]);
        if (!tournamentAdmin && !admin) {
            return NextResponse.json(
                { error: 'このドローを編集する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        // 各試合を更新
        const updates = matches.map((match: any) =>
            supabase
                .from('matches')
                .update({
                    umpire_id: match.umpire_id,
                    court_number: match.court_number,
                    status: match.status,
                })
                .eq('id', match.id)
        );

        const results = await Promise.all(updates);
        const errors = results.filter((r) => r.error);

        if (errors.length > 0) {
            return NextResponse.json(
                { error: '一部の試合の更新に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'ドローを更新しました' });
    } catch (error) {
        console.error('Update draw error:', error);
        return NextResponse.json(
            { error: 'ドローの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

