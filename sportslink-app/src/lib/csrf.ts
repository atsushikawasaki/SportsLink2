const CSRF_COOKIE_NAME = 'csrf_token';

export function getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export function getCsrfHeaders(): Record<string, string> {
    const token = getCsrfToken();
    if (!token) return {};
    return { 'X-CSRF-Token': token };
}
