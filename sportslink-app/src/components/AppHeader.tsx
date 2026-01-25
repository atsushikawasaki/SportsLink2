'use client';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import NotificationCenter from '@/components/NotificationCenter';
import NavigationMenu from '@/components/NavigationMenu';

export default function AppHeader() {
    const { user } = useAuthStore();
    const router = useRouter();

    return (
        <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 relative z-[1]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <NavigationMenu />
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            Sport Link
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationCenter />
                        <span className="text-slate-300">{user?.display_name || user?.email}</span>
                        <button
                            onClick={async () => {
                                await useAuthStore.getState().logout();
                                router.push('/login');
                            }}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            ログアウト
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}

