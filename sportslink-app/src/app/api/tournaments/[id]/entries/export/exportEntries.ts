import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/entries/export - CSVエクスポート
export async function exportEntries(id: string) {
    try {
        const supabase = await createClient();

        // 大会情報取得
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('name')
            .eq('id', id)
            .single();

        if (tournamentError || !tournament) {
            return NextResponse.json(
                { error: '大会が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        // チームと選手情報を取得
        const { data: teams, error: teamsError } = await supabase
            .from('teams')
            .select(`
                id,
                name,
                tournament_players (
                    id,
                    player_name,
                    player_type
                )
            `)
            .eq('tournament_id', id)
            .order('name', { ascending: true });

        if (teamsError) {
            return NextResponse.json(
                { error: teamsError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // CSV形式に変換
        const csvHeader = 'チーム名,選手名,ポジション\n';
        const csvRows = teams?.flatMap((team) => {
            if (!team.tournament_players || team.tournament_players.length === 0) {
                return `${team.name},,\n`;
            }
            return team.tournament_players.map((player: any) => {
                return `${team.name},${player.player_name},${player.player_type || ''}\n`;
            });
        }) || [];

        const csvContent = csvHeader + csvRows.join('');

        // UTF-8 BOM付きで返す
        const bom = '\uFEFF';
        const csvWithBom = bom + csvContent;

        return new NextResponse(csvWithBom, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="tournament-${id}-entries.csv"`,
            },
        });
    } catch (error) {
        console.error('Export entries error:', error);
        return NextResponse.json(
            { error: 'CSVエクスポートに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

