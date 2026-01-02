import { resetPassword } from './resetPassword';

export async function POST(request: Request) {
    return resetPassword(request);
}

