const TTL_MS = 24 * 60 * 60 * 1000;

type CachedResponse = { status: number; body: string; headers: Record<string, string>; expiresAt: number };

const store = new Map<string, CachedResponse>();

function getKey(request: Request): string | null {
    const key = request.headers.get('Idempotency-Key') ?? request.headers.get('idempotency-key');
    return key?.trim() || null;
}

function cleanup(): void {
    const now = Date.now();
    for (const [k, v] of Array.from(store.entries())) {
        if (v.expiresAt <= now) store.delete(k);
    }
}

export async function withIdempotency(
    request: Request,
    handler: () => Promise<Response>
): Promise<Response> {
    const key = getKey(request);
    if (!key) return handler();

    const now = Date.now();
    const cached = store.get(key);
    if (cached) {
        if (cached.expiresAt <= now) {
            store.delete(key);
        } else {
            return new Response(cached.body, {
                status: cached.status,
                headers: cached.headers,
            });
        }
    }

    const response = await handler();
    const status = response.status;
    if (status >= 200 && status < 300) {
        const body = await response.clone().text();
        const headers: Record<string, string> = {};
        response.headers.forEach((v, k) => {
            const lower = k.toLowerCase();
            if (lower !== 'transfer-encoding') headers[k] = v;
        });
        if (Object.keys(headers).length === 0) headers['Content-Type'] = 'application/json';
        store.set(key, { status, body, headers, expiresAt: now + TTL_MS });
        if (store.size > 10000) cleanup();
    }
    return response;
}
