import { submitContact } from './submitContact';

export async function POST(request: Request) {
    return submitContact(request);
}
