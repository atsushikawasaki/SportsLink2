import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_API_PREFIXES = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
];

const CSRF_COOKIE_NAME = 'csrf_token';

function isPublicApiPath(pathname: string): boolean {
    return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function generateCsrfToken(): string {
    const bytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    }
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function isStateChangingMethod(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const pathname = new URL(request.url).pathname;

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            return supabaseResponse;
        }

        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (pathname.startsWith('/api/')) {
            if (isStateChangingMethod(request.method) && !isPublicApiPath(pathname)) {
                const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
                const headerToken = request.headers.get('X-CSRF-Token') ?? request.headers.get('x-csrf-token');
                if (!cookieToken || !headerToken || cookieToken !== headerToken) {
                    return NextResponse.json(
                        { error: 'CSRFトークンが無効です', code: 'E-CSRF-001' },
                        { status: 403 }
                    );
                }
            }

            if (!isPublicApiPath(pathname) && !user) {
                if (userError) {
                    return NextResponse.json(
                        { error: 'セッションが無効です。再ログインしてください。', code: 'E-SESSION-001' },
                        { status: 401 }
                    );
                }
                return NextResponse.json(
                    { error: '認証が必要です', code: 'E-AUTH-001' },
                    { status: 401 }
                );
            }
        }

        if (!request.cookies.get(CSRF_COOKIE_NAME)?.value) {
            const token = generateCsrfToken();
            supabaseResponse.cookies.set(CSRF_COOKIE_NAME, token, {
                path: '/',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 7,
                httpOnly: false,
            });
        }
    } catch {
        if (pathname.startsWith('/api/') && !isPublicApiPath(pathname)) {
            return NextResponse.json(
                { error: 'セッションの確認に失敗しました。再ログインしてください。', code: 'E-SESSION-001' },
                { status: 401 }
            );
        }
    }

    return supabaseResponse;
}
