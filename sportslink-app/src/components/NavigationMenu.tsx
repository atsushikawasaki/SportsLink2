'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Home, Trophy, Users, Settings, ClipboardList, LogOut } from 'lucide-react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';

const menuItems = [
    { href: '/dashboard', label: 'ダッシュボード', icon: Home },
    { href: '/tournaments', label: '大会一覧', icon: Trophy },
    { href: '/assigned-matches', label: '担当試合・スコア', icon: ClipboardList },
    { href: '/teams', label: 'チーム一覧', icon: Users },
    { href: '/settings', label: '設定', icon: Settings },
] as const;

export default function NavigationMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // メニューが開いている時はbodyのスクロールを無効化
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/' || pathname === '/dashboard';
        }
        if (href === '/assigned-matches') {
            return pathname?.startsWith('/assigned-matches') || pathname?.startsWith('/scoring');
        }
        return pathname?.startsWith(href);
    };

    const NavLinks = () => (
        <div className="flex items-center gap-1">
            {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 min-h-[48px] ${
                            active
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                    </Link>
                );
            })}
        </div>
    );

    return (
        <>
            {/* デスクトップナビ（lg以上で表示） */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="メインメニュー">
                <NavLinks />
            </nav>
            {/* モバイル用ハンバーガーボタン */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden p-3 min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                aria-label="メニューを開く"
                aria-expanded={isOpen}
            >
                {isOpen ? (
                    <X className="w-6 h-6" />
                ) : (
                    <Menu className="w-6 h-6" />
                )}
            </button>

            {/* オーバーレイ */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[9998] transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* メニュー（左からスライドイン） */}
            <aside
                className={`fixed top-0 left-0 h-screen w-64 bg-slate-800 border-r border-slate-700 z-[9999] transform transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex flex-col h-full">
                    {/* メニューヘッダー */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-700">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            SportsLink
                        </h2>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-3 min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                            aria-label="メニューを閉じる"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* メニュー項目 */}
                    <nav className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-2">
                            {menuItems.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 min-h-[48px] ${
                                            active
                                                ? 'bg-blue-500/20 text-blue-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                        }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>

                    {/* ログアウト */}
                    <div className="p-4 border-t border-slate-700">
                        <button
                            onClick={async () => {
                                setIsOpen(false);
                                await useAuthStore.getState().logout();
                                router.push('/login');
                            }}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-slate-400 hover:bg-slate-700 hover:text-white w-full min-h-[48px]"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-medium">ログアウト</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
