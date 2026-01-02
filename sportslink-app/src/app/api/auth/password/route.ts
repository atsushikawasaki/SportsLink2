import { updatePassword } from './updatePassword';

export async function PUT(request: Request) {
    return updatePassword(request);
}

