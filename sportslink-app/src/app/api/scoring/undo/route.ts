import { undoPoint } from './undoPoint';

// POST /api/scoring/undo - Undo操作
export async function POST(request: Request) {
    return undoPoint(request);
}
