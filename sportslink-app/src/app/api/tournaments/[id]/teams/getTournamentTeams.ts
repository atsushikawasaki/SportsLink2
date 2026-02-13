import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/teams - 大会に参加しているチーム一覧取得（tournament_entries.team_id 経由）
export async function getTournamentTeams(id: string) {
    try {
        const supabase = await createClient();

        const { data: entryTeamIds, error: entryError } = await supabase
            .from('tournament_entries')
            .select('team_id')
            .eq('tournament_id', id)
            .not('team_id', 'is', null);

        if (entryError) {
            return NextResponse.json(
                { error: entryError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const teamIds = [...new Set((entryTeamIds || []).map((r) => r.team_id).filter(Boolean))] as string[];
        if (teamIds.length === 0) {
            return NextResponse.json([]);
        }

        const { data: teams, error } = await supabase
            .from('teams')
            .select('*')
            .in('id', teamIds)
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const teamList = teams || [];

        const { data: players, error: playersError } = await supabase
            .from('tournament_players')
            .select('id, player_name, player_type, actual_team_id')
            .in('actual_team_id', teamIds)
            .order('sort_order', { ascending: true, nullsFirst: true })
            .order('created_at', { ascending: true });

        if (playersError) {
            return NextResponse.json(
                { error: playersError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        const playersByTeam = new Map<string, Array<{ id: string; player_name: string; player_type: string }>>();
        for (const p of players || []) {
            if (!p.actual_team_id) continue;
            const list = playersByTeam.get(p.actual_team_id) ?? [];
            list.push({ id: p.id, player_name: p.player_name, player_type: p.player_type });
            playersByTeam.set(p.actual_team_id, list);
        }

        const teamsWithPlayers = teamList.map((team) => ({
            ...team,
            tournament_players: playersByTeam.get(team.id) ?? [],
        }));

        return NextResponse.json(teamsWithPlayers);
    } catch (error) {
        console.error('Get teams error:', error);
        return NextResponse.json(
            { error: 'チーム一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

