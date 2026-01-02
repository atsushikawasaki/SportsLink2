import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tables } from '@/types/database.types';

type User = Tables<'users'>;

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    accessToken: string | null;
    setUser: (user: User | null) => void;
    setAccessToken: (token: string | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,
            accessToken: null,
            setUser: (user) => set({ user, isAuthenticated: !!user }),
            setAccessToken: (token) => set({ accessToken: token }),
            setLoading: (loading) => set({ isLoading: loading }),
            logout: () => set({ user: null, isAuthenticated: false, accessToken: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
        }
    )
);
