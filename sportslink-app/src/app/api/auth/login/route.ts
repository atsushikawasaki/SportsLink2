import { loginUser } from './loginUser';

export async function POST(request: Request) {
    return loginUser(request);
}
