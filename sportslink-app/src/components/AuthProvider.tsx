'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { createClient } from '@/lib/supabase/client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setUser, setAccessToken, setLoading, logout, isLoading } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/consent');
    const isHomePage = pathname === '/';

    // Supabaseクライアントをメモ化
    const supabase = useMemo(() => createClient(), []);

    // 関数の最新の参照を保持（useEffectの依存配列から除外するため）
    const storeRef = useRef({ setUser, setAccessToken, setLoading, logout });
    storeRef.current = { setUser, setAccessToken, setLoading, logout };

    // 初回マウント時のみセッションチェックを実行するフラグ
    const hasCheckedSession = useRef(false);

    useEffect(() => {
        // 既にセッションチェック済みの場合はスキップ
        if (hasCheckedSession.current) return;
        hasCheckedSession.current = true;

        let isMounted = true;
        const { setUser, setAccessToken, setLoading, logout } = storeRef.current;

        const checkSession = async () => {
            try {
                setLoading(true);

                // Supabaseのセッションをチェック
                const { data: { session }, error } = await supabase.auth.getSession();

                if (!isMounted) return;

                if (error) {
                    console.error('Session check error:', error);
                    storeRef.current.logout();
                    if (!isAuthPage && !isHomePage) {
                        router.push('/login');
                    }
                    return;
                }

                if (session?.user) {
                    // セッションが有効な場合、ユーザープロファイルを取得
                    const { data: userProfile, error: profileError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (!isMounted) return;

                    if (profileError) {
                        console.warn('User profile not found:', profileError);
                        // プロファイルがなくても、セッションがあれば続行
                        storeRef.current.setUser({
                            id: session.user.id,
                            email: session.user.email || '',
                            display_name: session.user.user_metadata?.display_name || '',
                            created_at: session.user.created_at || new Date().toISOString(),
                        } as any);
                    } else {
                        storeRef.current.setUser(userProfile);
                    }

                    storeRef.current.setAccessToken(session.access_token);

                    // ログインページにいる場合はダッシュボードにリダイレクト
                    if (pathname === '/login') {
                        router.push('/dashboard');
                    }
                } else {
                    // セッションが無効な場合
                    storeRef.current.logout();
                    if (!isAuthPage && !isHomePage) {
                        router.push('/login');
                    }
                }
            } catch (error) {
                console.error('Auth check error:', error);
                if (isMounted) {
                    storeRef.current.logout();
                    if (!isAuthPage && !isHomePage) {
                        router.push('/login');
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
                    // セッションが更新された場合、ユーザープロファイルを取得
                    if (session?.user) {
                        const { data: userProfile, error: profileError } = await supabase
                            .from('users')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();

                        if (!isMounted) return;

                        if (profileError) {
                            console.warn('User profile not found:', profileError);
                            storeRef.current.setUser({
                                id: session.user.id,
                                email: session.user.email || '',
                                display_name: session.user.user_metadata?.display_name || '',
                                created_at: session.user.created_at || new Date().toISOString(),
                            } as any);
                        } else {
                            storeRef.current.setUser(userProfile);
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
    }, [supabase]);

    // ローディング中はローディングUIを表示（ホームページと認証ページ以外）
    if (isLoading && !isHomePage && !isAuthPage) {
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


