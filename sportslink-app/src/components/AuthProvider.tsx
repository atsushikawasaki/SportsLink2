'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { createClient } from '@/lib/supabase/client';
import { getCsrfToken } from '@/lib/csrf';

const AUTH_CHECK_TIMEOUT_MS = 10_000;
const LOADING_OVERLAY_MAX_MS = 2_000;

// CSRF fetch monkey-patch（一度だけ実行）
let fetchPatched = false;
function patchFetchOnce() {
    if (fetchPatched || typeof window === 'undefined') return;
    fetchPatched = true;
    const origFetch = window.fetch;
    window.fetch = function (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET'))?.toUpperCase();
        if (
            (url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`)) &&
            ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
        ) {
            const token = getCsrfToken();
            if (token) {
                const headers = new Headers(init?.headers);
                headers.set('X-CSRF-Token', token);
                return origFetch.call(this, input, { ...init, headers });
            }
        }
        return origFetch.call(this, input, init);
    };
}

const PUBLIC_PAGE_PREFIXES = [
    '/',
    '/login',
    '/signup',
    '/consent',
    '/privacy',
    '/terms',
    '/public-tournaments',
    '/support',
];

function isProtectedPath(pathname: string | null): boolean {
    if (!pathname || pathname === '/') return false;
    return !PUBLIC_PAGE_PREFIXES.some(
        (p) => pathname === p || (p !== '/' && pathname.startsWith(p + '/'))
    );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setUser, setAccessToken, setLoading, setHasHydrated, logout, isLoading } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/consent');
    const isHomePage = pathname === '/';

    const [loadingOverlayTimedOut, setLoadingOverlayTimedOut] = useState(false);

    const supabase = useMemo(() => createClient(), []);
    const storeRef = useRef({ setUser, setAccessToken, setLoading, logout });
    storeRef.current = { setUser, setAccessToken, setLoading, logout };
    // 初回セッションチェック完了フラグ（onAuthStateChangeの重複呼び出し防止用）
    const initialCheckDoneRef = useRef(false);

    // CSRF fetch patch（一度だけ）
    useEffect(() => {
        patchFetchOnce();
    }, []);

    useEffect(() => {
        setHasHydrated(true);

        let isMounted = true;
        initialCheckDoneRef.current = false;

        const setUserFromSession = (sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, any>; created_at?: string }) => {
            storeRef.current.setUser({
                id: sessionUser.id,
                email: sessionUser.email || '',
                display_name: sessionUser.user_metadata?.display_name || '',
                created_at: sessionUser.created_at || new Date().toISOString(),
            } as any);
        };

        const fetchProfile = async (sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, any>; created_at?: string }) => {
            try {
                const profileResponse = await fetch('/api/auth/me', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!isMounted) return;
                if (profileResponse.ok) {
                    const userProfile = await profileResponse.json();
                    storeRef.current.setUser(userProfile);
                } else {
                    console.warn('Failed to fetch user profile, using session data');
                    setUserFromSession(sessionUser);
                }
            } catch (fetchError) {
                console.warn('Error fetching user profile:', fetchError);
                if (isMounted) {
                    setUserFromSession(sessionUser);
                }
            }
        };

        const checkSession = async () => {
            try {
                storeRef.current.setLoading(true);

                const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

                if (!isMounted) return;

                if (sessionError) {
                    console.error('Session check error:', sessionError);
                    const currentUser = useAuthStore.getState().user;
                    if (!currentUser) {
                        storeRef.current.logout();
                        if (!isAuthPage && !isHomePage) {
                            router.push('/login');
                        }
                    }
                    return;
                }

                const session = sessionData?.session;

                if (session?.user) {
                    // セッション有効：プロフィール取得（1回のみ）
                    await fetchProfile(session.user);
                    storeRef.current.setAccessToken(session.access_token);

                    if (pathname === '/login') {
                        router.push('/dashboard');
                    }
                } else {
                    const currentUser = useAuthStore.getState().user;
                    if (currentUser) {
                        storeRef.current.logout();
                    }
                    if (!isAuthPage && !isHomePage) {
                        router.push('/login');
                    }
                }
            } catch (error) {
                console.error('Auth check error:', error);
                if (isMounted) {
                    const currentUser = useAuthStore.getState().user;
                    if (!currentUser) {
                        storeRef.current.logout();
                        if (!isAuthPage && !isHomePage) {
                            router.push('/login');
                        }
                    }
                }
            } finally {
                if (isMounted) {
                    storeRef.current.setLoading(false);
                    initialCheckDoneRef.current = true;
                }
            }
        };

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AUTH_CHECK_TIMEOUT')), AUTH_CHECK_TIMEOUT_MS)
        );
        Promise.race([checkSession(), timeoutPromise]).catch((err) => {
            if (err instanceof Error && err.message === 'AUTH_CHECK_TIMEOUT' && isMounted) {
                console.warn('Auth check timed out; allowing UI to render.');
                storeRef.current.setLoading(false);
                initialCheckDoneRef.current = true;
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!isMounted) return;

                // 初回の SIGNED_IN は checkSession で既に処理済みなのでスキップ
                if (event === 'SIGNED_IN' && !initialCheckDoneRef.current) {
                    return;
                }

                if (event === 'SIGNED_OUT' || !session) {
                    storeRef.current.logout();
                    if (!isAuthPage && !isHomePage) router.push('/login');
                } else if (event === 'TOKEN_REFRESHED') {
                    // トークンリフレッシュ時はアクセストークンだけ更新（プロフィール再取得不要）
                    if (session?.user) {
                        storeRef.current.setAccessToken(session.access_token);
                    }
                } else if (event === 'SIGNED_IN') {
                    // ログイン操作による SIGNED_IN（初回チェック後に発火した場合のみ）
                    if (session?.user) {
                        await fetchProfile(session.user);
                        storeRef.current.setAccessToken(session.access_token);
                    }
                }
            }
        );

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase]);

    useEffect(() => {
        setLoadingOverlayTimedOut(false);
        if (!pathname || !isProtectedPath(pathname) || !isLoading) return;
        const t = setTimeout(() => setLoadingOverlayTimedOut(true), LOADING_OVERLAY_MAX_MS);
        return () => clearTimeout(t);
    }, [pathname, isLoading]);

    const showLoadingOverlay =
        isProtectedPath(pathname) && isLoading && !loadingOverlayTimedOut;

    if (showLoadingOverlay) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="mt-4 text-slate-400">読み込み中...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}


