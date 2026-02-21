const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 10;

const store = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;
    return 'unknown';
}

export function checkRateLimit(request: Request, keyPrefix: string): { allowed: boolean; retryAfter?: number } {
    const key = `${keyPrefix}:${getClientKey(request)}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry) {
        store.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { allowed: true };
    }

    if (now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { allowed: true };
    }

    entry.count += 1;
    if (entry.count > MAX_ATTEMPTS) {
        return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { allowed: true };
}
