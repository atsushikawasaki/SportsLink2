import { getDrawTree } from './getDrawTree';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return getDrawTree(id);
}
