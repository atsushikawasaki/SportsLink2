import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/tournaments/:id/entries/import - CSVインポート
export async function importEntries(id: string, request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'ファイルが選択されていません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const text = await file.text();
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
            return NextResponse.json(
                { error: 'CSVファイルにデータが含まれていません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // ヘッダー行を解析
        const header = lines[0].split(',').map((h) => h.trim());
        const teamIndex = header.findIndex((h) => /team|チーム/i.test(h));
        const playerIndex = header.findIndex((h) => /player|選手|name|名前/i.test(h));
        const positionIndex = header.findIndex((h) => /type|ポジション|position/i.test(h));

        if (teamIndex === -1 || playerIndex === -1) {
            return NextResponse.json(
                { error: '必須カラム（チーム名、選手名）が見つかりません', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const results: Array<{ row: number; success: boolean; message: string }> = [];
        const teamMap = new Map<string, string>(); // チーム名 -> チームID

        // データ行を処理
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map((cell) => cell.trim());
            const teamName = row[teamIndex];
            const playerName = row[playerIndex];
            const playerType = positionIndex !== -1 ? row[positionIndex] : null;

            if (!teamName) {
                results.push({
                    row: i + 1,
                    success: false,
                    message: 'チーム名が空です',
                });
                continue;
            }

            try {
                // チームを取得または作成
                let teamId = teamMap.get(teamName);
                if (!teamId) {
                    const { data: existingTeam } = await supabase
                        .from('teams')
                        .select('id')
                        .eq('tournament_id', id)
                        .eq('name', teamName)
                        .single();

                    if (existingTeam) {
                        teamId = existingTeam.id;
                    } else {
                        const { data: newTeam, error: teamError } = await supabase
                            .from('teams')
                            .insert({
                                tournament_id: id,
                                name: teamName,
                            })
                            .select('id')
                            .single();

                        if (teamError || !newTeam) {
                            results.push({
                                row: i + 1,
                                success: false,
                                message: `チーム作成失敗: ${teamError?.message || '不明なエラー'}`,
                            });
                            continue;
                        }
                        teamId = newTeam.id;
                    }
                    teamMap.set(teamName, teamId);
                }

                // 選手を追加（選手名がある場合）
                if (playerName) {
                    const { error: playerError } = await supabase
                        .from('tournament_players')
                        .insert({
                            tournament_id: id,
                            team_id: teamId,
                            player_name: playerName,
                            player_type: playerType || '両方',
                        });

                    if (playerError) {
                        results.push({
                            row: i + 1,
                            success: false,
                            message: `選手追加失敗: ${playerError.message}`,
                        });
                        continue;
                    }
                }

                results.push({
                    row: i + 1,
                    success: true,
                    message: '成功',
                });
            } catch (error: any) {
                results.push({
                    row: i + 1,
                    success: false,
                    message: `エラー: ${error.message || '不明なエラー'}`,
                });
            }
        }

        return NextResponse.json({
            message: 'CSVインポートが完了しました',
            results,
        });
    } catch (error) {
        console.error('Import entries error:', error);
        return NextResponse.json(
            { error: 'CSVインポートに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

