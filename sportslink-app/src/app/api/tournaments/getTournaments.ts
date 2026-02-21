import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/tournaments - 大会一覧取得
export async function getTournaments(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const offsetParam = searchParams.get('offset');
        const limit = Math.max(1, Number.isNaN(parseInt(limitParam || '10', 10)) ? 10 : parseInt(limitParam || '10', 10));
        const offset = Math.max(0, Number.isNaN(parseInt(offsetParam || '0', 10)) ? 0 : parseInt(offsetParam || '0', 10));
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        const supabase = await createClient();

        let query = supabase
            .from('tournaments')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }

        if (startDate) {
            query = query.gte('start_date', startDate);
        }

        if (endDate) {
            query = query.lte('end_date', endDate);
        }

        const { data, error, count } = await query;

        if (error) {
            return NextResponse.json(
                { error: error.message, code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({ data, count, limit, offset });
    } catch (error) {
        console.error('Get tournaments error:', error);
        return NextResponse.json(
            { error: '大会一覧の取得に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

