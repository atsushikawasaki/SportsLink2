'use client';

import Link from 'next/link';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import NotificationCenter from '@/components/NotificationCenter';

export default function AppHeader() {
    const { user } = useAuthStore();

    return (
        <header className="sticky top-0 z-30 bg-[var(--color-bg-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border-base)]">
            <div className="px-4 sm:px-6 py-3">
                <div className="flex items-center justify-between">
                    <Link
                        href="/dashboard"
                        className="lg:hidden text-lg font-display font-bold text-brand"
                        aria-label="SportsLink ホーム"
                    >
                        SportsLink
                    </Link>
                    <div className="hidden lg:block" />
                    <div className="flex items-center gap-3">
                        <NotificationCenter />
                        <span className="text-sm text-[var(--color-text-secondary)] truncate max-w-[120px] sm:max-w-[200px] hidden sm:inline-block">
                            {user?.display_name || user?.email}
                        </span>
                    </div>
                </div>
            </div>
        </header>
    );
}
