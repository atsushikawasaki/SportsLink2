import { deleteAccount } from './deleteAccount';

export async function DELETE(request: Request) {
    return deleteAccount(request);
}

