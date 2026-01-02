import { updateDrawSlots } from './updateDrawSlots';

// PUT /api/tournaments/:id/draw/slots - ドロースロット更新
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return updateDrawSlots(id, request);
}
    try {
        const { id } = await params;
        const body = await request.json();
        const { match_id, slots } = body;

        if (!match_id || !Array.isArray(slots)) {
            return NextResponse.json(
                { error: '試合IDとスロットデータが必要です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // 各スロットを更新
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

