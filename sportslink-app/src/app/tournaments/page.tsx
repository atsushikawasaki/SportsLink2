'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Plus, Search, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Breadcrumbs from '@/components/Breadcrumbs';
import { SkeletonGrid } from '@/components/Skeleton';

interface Tournament {
    id: string;
    name: string;
    status: 'draft' | 'published' | 'finished';
    is_public: boolean;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
}

export default function TournamentsPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'finished'>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 20;

    const fetchTournaments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const offset = (page - 1) * limit;
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });

            if (statusFilter !== 'all') {
                params.append('status', statusFilter);
            }
            if (searchQuery) {
                params.append('search', searchQuery);
            }
            if (startDate) {
                params.append('start_date', startDate);
            }
            if (endDate) {
                params.append('end_date', endDate);
            }

            const response = await fetch(`/api/tournaments?${params.toString()}`);
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '大会一覧の取得に失敗しました');
                return;
            }

            setTournaments(result.data || []);
            setTotalCount(result.count || 0);
        } catch (err) {
            console.error('Failed to fetch tournaments:', err);
            setError('大会一覧の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [page, limit, statusFilter, searchQuery, startDate, endDate]);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        fetchTournaments();
    }, [isAuthenticated, router, fetchTournaments]);

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
            case 'draft':
            default:
                return (
                    <span className="px-3 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full">
                        下書き
                    </span>
                );
        }
    };

    // サーバーサイドでフィルタリングされているため、フロントエンドでのフィルタリングは不要
    const filteredTournaments = useMemo(() => tournaments, [tournaments]);

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <AppHeader />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8">
                            <Breadcrumbs items={[{ label: '大会一覧' }]} />
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mt-2">
                                大会一覧
                            </h1>
                        </div>

                {/* Filters and Actions */}
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="大会名で検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">すべて</option>
                                <option value="draft">下書き</option>
                                <option value="published">公開中</option>
                                <option value="finished">終了</option>
                            </select>
                        </div>

                        {/* New Tournament Button */}
                        <Link
                            href="/tournaments/new"
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                        >
                            <Plus className="w-5 h-5" />
                            新規大会作成
                        </Link>
                    </div>

                    {/* Date Range Filter */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <label className="text-sm text-slate-300">開始日:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-300">終了日:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => {
                                    setStartDate('');
                                    setEndDate('');
                                }}
                                className="px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                クリア
                            </button>
                        )}
                    </div>
                </div>

                {/* Tournaments List */}
                {loading ? (
                    <SkeletonGrid count={6} />
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={fetchTournaments}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            再試行
                        </button>
                    </div>
                ) : filteredTournaments.length === 0 ? (
                    <div className="text-center py-12">
                        <Trophy className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg mb-2">
                            {tournaments.length === 0 ? '大会がありません' : '条件に一致する大会がありません'}
                        </p>
                        {tournaments.length === 0 && (
                            <Link
                                href="/tournaments/new"
                                className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                最初の大会を作成
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTournaments.map((tournament) => (
                            <Link
                                key={tournament.id}
                                href={`/tournaments/${tournament.id}`}
                                className="block p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className="text-xl font-semibold text-white flex-1">{tournament.name}</h3>
                                    {getStatusBadge(tournament.status)}
                                </div>
                                {tournament.description && (
                                    <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                                        {tournament.description}
                                    </p>
                                )}
                                <div className="flex items-center justify-between text-sm text-slate-500">
                                    <span>
                                        {new Date(tournament.created_at).toLocaleDateString('ja-JP')}
                                    </span>
                                    {tournament.is_public && (
                                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                                            公開
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalCount > limit && (
                    <div className="mt-8 pt-6 border-t border-slate-700">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-400">
                                全{totalCount}大会中、{(page - 1) * limit + 1}〜{Math.min(page * limit, totalCount)}件を表示
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    前へ
                                </button>
                                <span className="px-4 py-2 text-slate-300">
                                    {page} / {Math.ceil(totalCount / limit)}
                                </span>
                                <button
                                    onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / limit), p + 1))}
                                    disabled={page >= Math.ceil(totalCount / limit)}
                                    className="px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                >
                                    次へ
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary */}
                {!loading && tournaments.length > 0 && totalCount <= limit && (
                    <div className="mt-8 pt-6 border-t border-slate-700">
                        <p className="text-sm text-slate-400 text-center">
                            全{totalCount}大会中、{filteredTournaments.length}大会を表示
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

