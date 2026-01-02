import { updateProfile } from './updateProfile';

export async function PUT(request: Request) {
    return updateProfile(request);
}

