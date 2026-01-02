import { resumeMatch } from './resumeMatch';

// POST /api/scoring/matches/:matchId/resume - 試合再開
export async function POST(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params;
    return resumeMatch(matchId);
}
