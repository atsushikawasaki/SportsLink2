import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments/:id/draw - ドロー取得
export async function getDraw(id: string) {
    try {
        const supabase = await createClient();

        // Tournament_Phasesを取得
        const { data: phases, error: phasesError } = await supabase
            .from('tournament_phases')
            .select('*')
            .eq('tournament_id', id)
            .order('sequence', { ascending: true });

        if (phasesError) {
            return NextResponse.json(
                { error: phasesError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // 各フェーズの試合を取得
        const phaseIds = phases?.map((p) => p.id) || [];
        const { data: matches, error: matchesError } = await supabase
            .from('matches')
            .select(`
                *,
                match_scores (
                    game_count_a,
                    game_count_b
                ),
                match_pairs (
                    id,
                    pair_number,
                    team_id,
                    teams:team_id (
                        id,
                        name
                    )
                ),
                match_slots (
                    id,
                    slot_number,
                    source_type,
                    entry_id,
                    source_match_id,
                    placeholder_label,
                    tournament_entries:entry_id (
                        id,
                        entry_type,
                        teams:team_id (
                            id,
                            name,
                            school_name
                        )
                    )
                )
            `)
            .in('phase_id', phaseIds.length > 0 ? phaseIds : ['00000000-0000-0000-0000-000000000000'])
            .order('round_index', { ascending: true })
            .order('slot_index', { ascending: true });

        if (matchesError) {
            return NextResponse.json(
                { error: matchesError.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            phases: phases || [],
            matches: matches || [],
        });
    } catch (error) {
        console.error('Get draw error:', error);
        return NextResponse.json(
            { error: 'ドローの取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

