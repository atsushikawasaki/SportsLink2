'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import Link from 'next/link';
import { Trophy, Search, Filter, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CollapsibleFilters from '@/components/ui/CollapsibleFilters';

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

export default function PublicTournamentsPage() {
    const { isAuthenticated } = useAuthStore();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'finished' | 'draft'>('all');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 20;

    const fetchTournaments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const offset = (page - 1) * limit;
            const response = await fetch(`/api/tournaments?limit=${limit}&offset=${offset}&is_public=true`);
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '大会一覧の取得に失敗しました');
                return;
            }

            const publicTournaments = (result.data || []).filter((t: Tournament) => t.is_public);
            setTournaments(publicTournaments);
            setTotalCount(result.count || publicTournaments.length);
        } catch (err) {
            console.error('Failed to fetch tournaments:', err);
            setError('大会一覧の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [page, limit]);

    useEffect(() => {
        fetchTournaments();
    }, [fetchTournaments]);

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

    const filteredTournaments = tournaments.filter((tournament) => {
        // 検索クエリ
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (
                !tournament.name.toLowerCase().includes(query) &&
                !(tournament.description && tournament.description.toLowerCase().includes(query))
            ) {
                return false;
            }
        }

        // ステータスフィルター
        if (statusFilter !== 'all' && tournament.status !== statusFilter) {
            return false;
        }

        return true;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 mb-8">
                    <div className="flex items-center justify-between py-4">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            公開大会一覧
                        </h1>
                        <div className="flex items-center gap-4">
                            {isAuthenticated && <NotificationCenter />}
                            {isAuthenticated && (
                                <Link
                                    href="/dashboard"
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    ダッシュボード
                                </Link>
                            )}
                        </div>
                    </div>
                </header>

                <CollapsibleFilters>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="大会名で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'finished' | 'draft')}
                            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="all">すべてのステータス</option>
                            <option value="published">公開中</option>
                            <option value="finished">終了</option>
                            <option value="draft">下書き</option>
                        </select>
                    </div>
                </div>
                </CollapsibleFilters>

                {/* Tournaments List */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={fetchTournaments}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                        >
                            再試行
                        </button>
                    </div>
                ) : filteredTournaments.length === 0 ? (
                    <div className="text-center py-12">
                        <Trophy className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg mb-2">
                            {tournaments.length === 0 ? '公開大会がありません' : '条件に一致する大会がありません'}
                        </p>
                        {tournaments.length === 0 && (
                            <p className="text-slate-500 text-sm mb-6">
                                大会を公開設定にすると、ここに表示されます
                            </p>
                        )}
                        {tournaments.length === 0 && (
                            <Link
                                href="/tournaments"
                                className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                大会一覧へ
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTournaments.map((tournament) => (
                            <div
                                key={tournament.id}
                                className="p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
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
                                <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                                    {tournament.start_date && (
                                        <span>
                                            {new Date(tournament.start_date).toLocaleDateString('ja-JP')}
                                            {tournament.end_date && ` - ${new Date(tournament.end_date).toLocaleDateString('ja-JP')}`}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Link
                                        href={`/tournaments/${tournament.id}/live`}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
                                    >
                                        <Eye className="w-4 h-4" />
                                        観戦
                                    </Link>
                                </div>
                            </div>
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

