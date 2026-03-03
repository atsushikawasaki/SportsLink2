const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 10;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_STORE_SIZE = 10000;

const store = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS && store.size < MAX_STORE_SIZE) return;
    lastCleanup = now;
    for (const [key, entry] of store) {
        if (now >= entry.resetAt) {
            store.delete(key);
        }
    }
}

function getClientKey(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;
    return 'unknown';
}

interface RateLimitOptions {
    windowMs?: number;
    maxAttempts?: number;
}

export function checkRateLimit(
    request: Request,
    keyPrefix: string,
    options?: RateLimitOptions
): { allowed: boolean; retryAfter?: number } {
    cleanupExpiredEntries();

    const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
    const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

    const key = `${keyPrefix}:${getClientKey(request)}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
    }

    if (now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
    }

    entry.count += 1;
    if (entry.count > maxAttempts) {
        return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { allowed: true };
}
