import { withIdempotency } from '@/lib/idempotency';
import { signupUser } from './signupUser';

export async function POST(request: Request) {
    return withIdempotency(request, () => signupUser(request));
}
