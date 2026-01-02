import { signupUser } from './signupUser';

export async function POST(request: Request) {
    return signupUser(request);
}
