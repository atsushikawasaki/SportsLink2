import { finishTournament } from './finishTournament';

// POST /api/tournaments/:id/finish - 大会終了
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return finishTournament(id);
}
