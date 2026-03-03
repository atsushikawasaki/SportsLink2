'use client';

import { useState, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import Link from 'next/link';
import { Trophy, Plus, Search, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import AppShell from '@/components/AppShell';
import Breadcrumbs from '@/components/Breadcrumbs';
import { SkeletonGrid } from '@/components/Skeleton';
import CollapsibleFilters from '@/components/ui/CollapsibleFilters';
import { useTournaments } from '@/lib/hooks/queries/useTournaments';

export default function TournamentsPage() {
    const { isAuthenticated } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'finished'>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [page, setPage] = useState(1);
    const limit = 20;

    const params = useMemo(
        () => ({
            limit,
            offset: (page - 1) * limit,
            status: statusFilter,
            search: searchQuery || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
        }),
        [page, statusFilter, searchQuery, startDate, endDate]
    );

    const { data, isLoading, error, refetch } = useTournaments(params);

    const tournaments = data?.data ?? [];
    const totalCount = data?.count ?? 0;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'published':
                return (
                    <span className="px-3 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
                        公開中
                    </span>
                );
            case 'finished':
                return (
                    <span className="px-3 py-1 text-xs font-medium bg-slate-500/20 text-slate-400 rounded-full">
                        終了
                    </span>
                );
            default:
                return (
                    <span className="px-3 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full">
                        下書き
                    </span>
                );
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <Breadcrumbs items={[{ label: '大会一覧' }]} />
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mt-2">
                        大会一覧
                    </h1>
                </div>

                <div className="mb-4 flex justify-end md:hidden">
                    <Link
                        href="/tournaments/new"
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                    >
                        <Plus className="w-5 h-5" />
                        新規大会作成
                    </Link>
                </div>

                <CollapsibleFilters>
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                                <input
                                    type="text"
                                    placeholder="大会名で検索..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-surface-2)]/50 border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value as typeof statusFilter);
                                        setPage(1);
                                    }}
                                    className="px-3 py-2 bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                >
                                    <option value="all">すべて</option>
                                    <option value="draft">下書き</option>
                                    <option value="published">公開中</option>
                                    <option value="finished">終了</option>
                                </select>
                            </div>

                            <Link
                                href="/tournaments/new"
                                className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                            >
                                <Plus className="w-5 h-5" />
                                新規大会作成
                            </Link>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
                                <label className="text-sm text-[var(--color-text-secondary)]">開始日:</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setPage(1);
                                    }}
                                    className="px-3 py-2 bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-[var(--color-text-secondary)]">終了日:</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setPage(1);
                                    }}
                                    className="px-3 py-2 bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                                />
                            </div>
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        setPage(1);
                                    }}
                                    className="px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                                >
                                    クリア
                                </button>
                            )}
                        </div>
                    </div>
                </CollapsibleFilters>

                {isLoading ? (
                    <SkeletonGrid count={6} />
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-400 mb-4">{(error as Error).message}</p>
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors"
                        >
                            再試行
                        </button>
                    </div>
                ) : tournaments.length === 0 ? (
                    <div className="text-center py-12">
                        <Trophy className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" />
                        <p className="text-[var(--color-text-muted)] text-lg mb-2">
                            {searchQuery || statusFilter !== 'all'
                                ? '条件に一致する大会がありません'
                                : '大会がありません'}
                        </p>
                        {!searchQuery && statusFilter === 'all' && (
                            <Link
                                href="/tournaments/new"
                                className="inline-block mt-4 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors"
                            >
                                最初の大会を作成
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tournaments.map((tournament) => (
                            <Link
                                key={tournament.id}
                                href={`/tournaments/${tournament.id}`}
                                className="block p-6 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] hover:border-[var(--color-border-base)] transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className="text-xl font-semibold text-[var(--color-text-primary)] flex-1">{tournament.name}</h3>
                                    {getStatusBadge(tournament.status)}
                                </div>
                                {tournament.description && (
                                    <p className="text-[var(--color-text-muted)] text-sm mb-4 line-clamp-2">
                                        {tournament.description}
                                    </p>
                                )}
                                <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
                                    <span>
                                        {new Date(tournament.created_at).toLocaleDateString('ja-JP')}
                                    </span>
                                    {tournament.is_public && (
                                        <span className="px-2 py-1 bg-blue-500/20 text-brand rounded text-xs">
                                            公開
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {!isLoading && totalCount > limit && (
                    <div className="mt-8 pt-6 border-t border-[var(--color-border-base)]">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-[var(--color-text-muted)]">
                                全{totalCount}大会中、{(page - 1) * limit + 1}〜
                                {Math.min(page * limit, totalCount)}件を表示
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-2 bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-surface-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    前へ
                                </button>
                                <span className="px-4 py-2 text-[var(--color-text-secondary)]">
                                    {page} / {Math.ceil(totalCount / limit)}
                                </span>
                                <button
                                    onClick={() =>
                                        setPage((p) => Math.min(Math.ceil(totalCount / limit), p + 1))
                                    }
                                    disabled={page >= Math.ceil(totalCount / limit)}
                                    className="px-3 py-2 bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-surface-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    次へ
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && tournaments.length > 0 && totalCount <= limit && (
                    <div className="mt-8 pt-6 border-t border-[var(--color-border-base)]">
                        <p className="text-sm text-[var(--color-text-muted)] text-center">
                            全{totalCount}大会を表示
                        </p>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
