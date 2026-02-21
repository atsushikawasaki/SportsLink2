import { isAdmin, isTournamentAdmin } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/tournaments/:id/players - 大会に選手を追加（大会管理者または管理者）
 * id = tournament_id, body: { team_id, player_name, player_type }
 */
export async function addTournamentPlayer(id: string, request: Request) {
    try {
        const body = await request.json();
        const { team_id, player_name, player_type } = body;

        if (!team_id || !player_name || !player_type) {
            return NextResponse.json(
                { error: 'チームID、選手名、ポジションは必須です', code: 'E-VER-003' },
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
                { error: 'この大会に選手を追加する権限がありません', code: 'E-AUTH-002' },
                { status: 403 }
            );
        }

        const { data: newEntry, error: entryError } = await supabase
            .from('tournament_entries')
            .insert({
                tournament_id: id,
                entry_type: 'singles',
                team_id,
                pair_id: null,
                custom_display_name: player_name.trim().split(/\s/)[0] || player_name,
                is_active: true,
            })
            .select('id')
            .single();

        if (entryError || !newEntry) {
            return NextResponse.json(
                { error: entryError?.message || 'エントリーの作成に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const { data: newPlayer, error: playerError } = await supabase
            .from('tournament_players')
            .insert({
                entry_id: newEntry.id,
                actual_team_id: team_id,
                player_name,
                player_type: player_type === '前衛' || player_type === '後衛' || player_type === '両方' ? player_type : '両方',
                sort_order: 1,
            })
            .select('id')
            .single();

        if (playerError || !newPlayer) {
            return NextResponse.json(
                { error: playerError?.message || '選手の登録に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const { data: newPair, error: pairError } = await supabase
            .from('tournament_pairs')
            .insert({
                entry_id: newEntry.id,
                pair_number: 1,
                player_1_id: newPlayer.id,
                player_2_id: null,
            })
            .select('id')
            .single();

        if (pairError || !newPair) {
            return NextResponse.json(
                { error: pairError?.message || 'ペアの登録に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const { error: updateError } = await supabase
            .from('tournament_entries')
            .update({ pair_id: newPair.id })
            .eq('id', newEntry.id);

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message || 'エントリーの更新に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const { data: player } = await supabase
            .from('tournament_players')
            .select('*')
            .eq('id', newPlayer.id)
            .single();

        return NextResponse.json(player ?? newPlayer, { status: 201 });
    } catch (error) {
        console.error('Create player error:', error);
        return NextResponse.json(
            { error: '選手の追加に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
