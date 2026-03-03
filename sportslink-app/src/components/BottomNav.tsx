'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Users, Settings } from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'ホーム', icon: Home },
    { href: '/tournaments', label: '大会', icon: Trophy },
    { href: '/teams', label: 'チーム', icon: Users },
    { href: '/settings', label: '設定', icon: Settings },
] as const;

export default function BottomNav() {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
        return pathname?.startsWith(href);
    };

    return (
        <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-base)]"
            aria-label="ボトムナビゲーション"
        >
            <div className="flex items-stretch justify-around">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 min-h-[56px] transition-colors ${
                                active
                                    ? 'text-brand'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                            }`}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
