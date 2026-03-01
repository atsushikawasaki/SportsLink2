import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tables } from '@/types/database.types';
import { createClient } from '@/lib/supabase/client';

type User = Tables<'users'>;

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    accessToken: string | null;
    hasHydrated: boolean;
    setUser: (user: User | null) => void;
    setAccessToken: (token: string | null) => void;
    setLoading: (loading: boolean) => void;
    setHasHydrated: (hydrated: boolean) => void;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            accessToken: null,
            hasHydrated: false,
            setUser: (user) => set({ user, isAuthenticated: !!user }),
            setAccessToken: (token) => set({ accessToken: token }),
            setLoading: (loading) => set({ isLoading: loading }),
            setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
            logout: async () => {
                // Supabaseのセッションをクリア
                try {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                } catch (error) {
                    console.error('Error signing out from Supabase:', error);
                }
                // ストアの状態をクリア
                set({ user: null, isAuthenticated: false, accessToken: null });
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ user: state.user }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.setHasHydrated(true);
                    // localStorageにユーザー情報があれば即座に認証済み扱いにする
                    if (state.user) {
                        state.setUser(state.user);
                    }
                }
            },
        }
    )
);

