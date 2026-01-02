import { sendPasswordResetEmail } from './sendPasswordResetEmail';

export async function POST(request: Request) {
    return sendPasswordResetEmail(request);
}

