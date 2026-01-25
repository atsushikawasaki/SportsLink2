'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { createClient } from '@/lib/supabase/client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setUser, setAccessToken, setLoading, logout, isAuthenticated } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/consent');

    useEffect(() => {
        const checkSession = async () => {
            try {
                setLoading(true);
                const supabase = createClient();
                
                // Supabaseのセッションをチェック
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Session check error:', error);
                    logout();
                    if (!isAuthPage) {
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

                    if (profileError) {
                        console.warn('User profile not found:', profileError);
                        // プロファイルがなくても、セッションがあれば続行
                        setUser({
                            id: session.user.id,
                            email: session.user.email || '',
                            display_name: session.user.user_metadata?.display_name || '',
                            created_at: session.user.created_at || new Date().toISOString(),
                        } as any);
                    } else {
                        setUser(userProfile);
                    }

                    setAccessToken(session.access_token);

                    // 認証が必要なページにいる場合、ログインページからリダイレクト
                    if (isAuthPage && pathname === '/login') {
                        router.push('/dashboard');
                    }
                } else {
                    // セッションが無効な場合
                    logout();
                    if (!isAuthPage) {
                        router.push('/login');
                    }
                }
            } catch (error) {
                console.error('Auth check error:', error);
                logout();
                if (!isAuthPage) {
                    router.push('/login');
                }
            } finally {
                setLoading(false);
            }
        };

        checkSession();

        // セッション変更を監視
        const supabase = createClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_OUT' || !session) {
                    logout();
                    if (!isAuthPage) {
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

                        if (profileError) {
                            console.warn('User profile not found:', profileError);
                            setUser({
                                id: session.user.id,
                                email: session.user.email || '',
                                display_name: session.user.user_metadata?.display_name || '',
                                created_at: session.user.created_at || new Date().toISOString(),
                            } as any);
                        } else {
                            setUser(userProfile);
                        }

                        setAccessToken(session.access_token);
                    }
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [setUser, setAccessToken, setLoading, logout, router, pathname, isAuthPage]);

    return <>{children}</>;
}

