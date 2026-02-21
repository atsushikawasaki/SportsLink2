import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// PUT /api/tournaments/:id/draw/slots - ドロースロット更新（大会管理者または管理者）
export async function updateDrawSlots(id: string, request: Request) {
    try {
        const body = await request.json();
        const { match_id, slots } = body;

        if (!match_id || !Array.isArray(slots)) {
            return NextResponse.json(
                { error: '試合IDとスロットデータが必要です', code: 'E-VER-003' },
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
                { error: 'このドローのスロットを編集する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('id, status, tournament_id')
            .eq('id', match_id)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }
        if (match.tournament_id !== id) {
            return NextResponse.json(
                { error: '試合がこの大会に属していません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        if (match.status !== 'pending') {
            return NextResponse.json(
                {
                    error: 'スロット編集は試合が未開始（pending）の場合のみ可能です。進行中・終了済みの試合は編集できません。',
                    code: 'E-VER-003',
                },
                { status: 400 }
            );
        }

        const updates = slots.map((slot: any) => {
            const updateData: any = {
                source_type: slot.source_type,
            };

            if (slot.source_type === 'entry') {
                updateData.entry_id = slot.entry_id || null;
                updateData.source_match_id = null;
                updateData.placeholder_label = null;
            } else if (slot.source_type === 'winner' || slot.source_type === 'loser') {
                updateData.source_match_id = slot.source_match_id || null;
                updateData.entry_id = null;
                updateData.placeholder_label = null;
            } else if (slot.source_type === 'bye') {
                updateData.entry_id = null;
                updateData.source_match_id = null;
                updateData.placeholder_label = slot.placeholder_label || 'BYE';
            }

            return supabase
                .from('match_slots')
                .update(updateData)
                .eq('id', slot.id);
        });

        const results = await Promise.all(updates);
        const errors = results.filter((r) => r.error);

        if (errors.length > 0) {
            console.error('Slot update errors:', errors);
            return NextResponse.json(
                { error: '一部のスロットの更新に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'ドロースロットを更新しました' });
    } catch (error) {
        console.error('Update draw slots error:', error);
        return NextResponse.json(
            { error: 'ドロースロットの更新に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

