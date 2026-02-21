import { withIdempotency } from '@/lib/idempotency';
import { getTournaments } from './getTournaments';
import { createTournament } from './createTournament';

// GET /api/tournaments - 大会一覧取得
export async function GET(request: Request) {
    return getTournaments(request);
}

// POST /api/tournaments - 大会作成
export async function POST(request: Request) {
    return withIdempotency(request, () => createTournament(request));
}
