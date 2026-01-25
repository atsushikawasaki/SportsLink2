import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// POST /api/scoring/points - ポイント入力
export async function addPoint(request: Request) {
    try {
        const body = await request.json();
        const { match_id, point_type, client_uuid, matchVersion } = body;

        if (!match_id || !point_type || !client_uuid) {
            return NextResponse.json(
                { error: '必須パラメータが不足しています', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Check version for optimistic locking
        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('version, status')
            .eq('id', match_id)
            .single();

        if (matchError || !match) {
            return NextResponse.json(
                { error: '試合が見つかりません', code: 'E-NOT-FOUND' },
                { status: 404 }
            );
        }

        if (matchVersion && match.version !== matchVersion) {
            return NextResponse.json(
                { error: 'データが競合しています。再同期してください', code: 'E-CONFL-001' },
                { status: 409 }
            );
        }

        if (match.status !== 'inprogress') {
            return NextResponse.json(
                { error: '進行中の試合のみポイントを追加できます', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        // Insert point
        const { data: point, error: pointError } = await supabase
            .from('points')
            .insert({
                id: uuidv4(),
                match_id,
                point_type,
                client_uuid,
                server_received_at: new Date().toISOString(),
                is_undone: false,
            })
            .select()
            .single();

        if (pointError) {
            return NextResponse.json(
                { error: pointError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // Increment version
        await supabase
            .from('matches')
            .update({ version: match.version + 1 })
            .eq('id', match_id);

        // Get updated match scores
        const { data: matchScores } = await supabase
            .from('match_scores')
            .select('*')
            .eq('match_id', match_id)
            .single();

        return NextResponse.json(
            {
                point,
                newVersion: match.version + 1,
                match_scores: matchScores
                    ? {
                          game_count_a: matchScores.game_count_a,
                          game_count_b: matchScores.game_count_b,
                      }
                    : null,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Add point error:', error);
        return NextResponse.json(
            { error: 'ポイントの追加に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

