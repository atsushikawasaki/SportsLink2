'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Trophy, Calendar, Settings, Award, Eye } from 'lucide-react';

interface TournamentSubNavProps {
    tournamentId: string;
}

const navItems = [
    { key: 'entries', href: 'entries', label: 'エントリー', icon: Users },
    { key: 'draw', href: 'draw', label: 'ドロー', icon: Trophy },
    { key: 'assignments', href: 'assignments', label: '割当', icon: Calendar },
    { key: 'results', href: 'results', label: '結果', icon: Award },
    { key: 'live', href: 'live', label: 'ライブ', icon: Eye },
    { key: 'roles', href: 'roles', label: '権限', icon: Settings },
];

export default function TournamentSubNav({ tournamentId }: TournamentSubNavProps) {
    const pathname = usePathname();
    const basePath = `/tournaments/${tournamentId}`;

    return (
        <nav
            className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-700 pb-1 scrollbar-hide"
            aria-label="大会サブメニュー"
        >
            {navItems.map((item) => {
                const fullHref = `${basePath}/${item.href}`;
                const isActive = pathname === fullHref;
                const Icon = item.icon;
                return (
                    <Link
                        key={item.key}
                        href={fullHref}
                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
                            isActive
                                ? 'bg-slate-700/50 text-blue-400 border-b-2 border-blue-400'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
