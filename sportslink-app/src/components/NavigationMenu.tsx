'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Trophy, Users, Settings, ClipboardList, LogOut, Plus } from 'lucide-react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';

const menuItems = [
    { href: '/dashboard', label: 'ダッシュボード', icon: Home },
    { href: '/tournaments', label: '大会一覧', icon: Trophy },
    { href: '/assigned-matches', label: '担当試合・スコア', icon: ClipboardList },
    { href: '/teams', label: 'チーム一覧', icon: Users },
    { href: '/settings', label: '設定', icon: Settings },
] as const;

export default function NavigationMenu() {
    const pathname = usePathname();
    const router = useRouter();

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
        if (href === '/assigned-matches') {
            return pathname?.startsWith('/assigned-matches') || pathname?.startsWith('/scoring');
        }
        return pathname?.startsWith(href);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-5 border-b border-[var(--color-border-base)]">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <span className="text-xl font-display font-bold text-brand">SportsLink</span>
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="メインメニュー">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-h-[44px] ${
                                active
                                    ? 'bg-brand/20 text-brand'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-2)] hover:text-[var(--color-text-primary)]'
                            }`}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="px-3 py-4 space-y-2 border-t border-[var(--color-border-base)]">
                <Link
                    href="/tournaments/new"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    新規大会を作成
                </Link>
                <button
                    onClick={async () => {
                        await useAuthStore.getState().logout();
                        router.push('/login');
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-2)] hover:text-[var(--color-text-primary)] w-full min-h-[44px]"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">ログアウト</span>
                </button>
            </div>
        </div>
    );
}
