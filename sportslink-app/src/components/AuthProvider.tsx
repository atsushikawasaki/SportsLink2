'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { createClient } from '@/lib/supabase/client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setUser, setAccessToken, setLoading, logout, isLoading, hasHydrated } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/consent');
    const isHomePage = pathname === '/';

    // Supabaseクライアントをメモ化
    const supabase = useMemo(() => createClient(), []);

    // 関数の最新の参照を保持（useEffectの依存配列から除外するため）
    const storeRef = useRef({ setUser, setAccessToken, setLoading, logout });
    storeRef.current = { setUser, setAccessToken, setLoading, logout };

    useEffect(() => {
        // Zustandのhydrationが完了するまで待つ
        if (!hasHydrated) return;

        let isMounted = true;
        const { setUser, setAccessToken, setLoading, logout } = storeRef.current;

        const checkSession = async () => {
            try {
                setLoading(true);

                // Supabaseのセッションチェック（タイムアウトなしで、より確実にセッションを取得）
                const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

                if (!isMounted) return;

                if (sessionError) {
                    console.error('Session check error:', sessionError);
                    // エラーが発生した場合でも、ストアに保存された情報があれば一時的に使用
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
                    // セッションが有効な場合、API経由でユーザープロファイルを取得
                    try {
                        const profileResponse = await fetch('/api/auth/me', {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        });

                        if (!isMounted) return;

                        if (profileResponse.ok) {
                            const userProfile = await profileResponse.json();
                            storeRef.current.setUser(userProfile);
                        } else {
                            // APIエラーの場合、セッション情報から基本情報を設定
                            console.warn('Failed to fetch user profile, using session data');
                            storeRef.current.setUser({
                                id: session.user.id,
                                email: session.user.email || '',
                                display_name: session.user.user_metadata?.display_name || '',
                                created_at: session.user.created_at || new Date().toISOString(),
                            } as any);
                        }
                    } catch (fetchError) {
                        console.warn('Error fetching user profile:', fetchError);
                        // エラーの場合、セッション情報から基本情報を設定
                        if (isMounted) {
                            storeRef.current.setUser({
                                id: session.user.id,
                                email: session.user.email || '',
                                display_name: session.user.user_metadata?.display_name || '',
                                created_at: session.user.created_at || new Date().toISOString(),
                            } as any);
                        }
                    }

                    storeRef.current.setAccessToken(session.access_token);

                    // ログインページにいる場合はダッシュボードにリダイレクト
                    if (pathname === '/login') {
                        router.push('/dashboard');
                    }
                } else {
                    // セッションが無効な場合、ストアに保存された情報もクリア
                    const currentUser = useAuthStore.getState().user;
                    if (currentUser) {
                        // ストアに情報があるがセッションがない場合、ログアウト
                        storeRef.current.logout();
                    }
                    if (!isAuthPage && !isHomePage) {
                        router.push('/login');
                    }
                }
            } catch (error) {
                console.error('Auth check error:', error);
                if (isMounted) {
                    // エラーが発生した場合でも、ストアに保存された情報があれば一時的に使用
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
                }
            }
        };

        checkSession();

        // セッション変更を監視
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!isMounted) return;

                if (event === 'SIGNED_OUT' || !session) {
                    storeRef.current.logout();
                    if (!isAuthPage && !isHomePage) {
                        router.push('/login');
                    }
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    // セッションが更新された場合、API経由でユーザープロファイルを取得
                    if (session?.user) {
                        try {
                            const profileResponse = await fetch('/api/auth/me', {
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            });

                            if (!isMounted) return;

                            if (profileResponse.ok) {
                                const userProfile = await profileResponse.json();
                                storeRef.current.setUser(userProfile);
                            } else {
                                // APIエラーの場合、セッション情報から基本情報を設定
                                console.warn('Failed to fetch user profile, using session data');
                                storeRef.current.setUser({
                                    id: session.user.id,
                                    email: session.user.email || '',
                                    display_name: session.user.user_metadata?.display_name || '',
                                    created_at: session.user.created_at || new Date().toISOString(),
                                } as any);
                            }
                        } catch (fetchError) {
                            console.warn('Error fetching user profile:', fetchError);
                            // エラーの場合、セッション情報から基本情報を設定
                            if (isMounted) {
                                storeRef.current.setUser({
                                    id: session.user.id,
                                    email: session.user.email || '',
                                    display_name: session.user.user_metadata?.display_name || '',
                                    created_at: session.user.created_at || new Date().toISOString(),
                                } as any);
                            }
                        }

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
    }, [supabase, hasHydrated]);

    // ローディング中はローディングUIを表示（ホームページと認証ページ以外）
    // hydrationが完了していない場合もローディング表示
    if ((!hasHydrated || isLoading) && !isHomePage && !isAuthPage) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <p className="mt-4 text-slate-400">読み込み中...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}


