import { addPoint } from './addPoint';

// POST /api/scoring/points - ポイント入力
export async function POST(request: Request) {
    return addPoint(request);
}
