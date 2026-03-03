'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import AppShell from '@/components/AppShell';
import Breadcrumbs from '@/components/Breadcrumbs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Team {
    id: string;
    name: string;
    description?: string | null;
    team_manager_user_id: string | null;
    created_at: string;
    tournament_players?: Array<{
        id: string;
        player_name: string;
        player_type: string;
    }>;
}

export default function TeamsPage() {
    const router = useRouter();
    const { isAuthenticated } = useAuthStore();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 20;

    const fetchTeams = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const offset = (page - 1) * limit;
            const response = await fetch(`/api/teams?limit=${limit}&offset=${offset}`);
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'チーム一覧の取得に失敗しました');
                return;
            }

            setTeams(result.data || []);
            setTotalCount(result.count || 0);
        } catch (err) {
            console.error('Failed to fetch teams:', err);
            setError('チーム一覧の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [page, limit]);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        fetchTeams();
    }, [isAuthenticated, router, fetchTeams]);

    const filteredTeams = teams.filter((team) => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return team.name.toLowerCase().includes(query);
        }
        return true;
    });

    if (!isAuthenticated) {
        return null;
    }

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <Breadcrumbs items={[{ label: 'チーム一覧' }]} />
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mt-2">
                        チーム一覧
                    </h1>
                </div>

                {/* Search and Actions */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            placeholder="チーム名・学校名で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-surface-2)]/50 border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        />
                    </div>
                </div>

                {/* Teams List */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={fetchTeams}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                            再試行
                        </button>
                    </div>
                ) : filteredTeams.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" />
                        <p className="text-[var(--color-text-muted)] text-lg mb-2">
                            {teams.length === 0 ? 'チームがありません' : '条件に一致するチームがありません'}
                        </p>
                        {teams.length === 0 && (
                            <p className="text-[var(--color-text-muted)] text-sm mb-6">
                                大会のエントリー管理でチームを登録できます
                            </p>
                        )}
                        {teams.length === 0 && (
                            <Link
                                href="/tournaments"
                                className="inline-block px-6 py-3 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors"
                            >
                                大会一覧へ
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTeams.map((team) => (
                            <div
                                key={team.id}
                                className="p-6 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] hover:border-[var(--color-border-base)] transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">{team.name}</h3>
                                        <p className="text-[var(--color-text-muted)] text-sm">チーム</p>
                                    </div>
                                </div>
                                {team.description && (
                                    <p className="text-[var(--color-text-secondary)] text-sm mb-4 line-clamp-2">{team.description}</p>
                                )}
                                <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)] mb-4">
                                    <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {team.tournament_players?.length || 0}名
                                    </span>
                                    <span>{new Date(team.created_at).toLocaleDateString('ja-JP')}</span>
                                </div>
                                <Link
                                    href={`/teams/${team.id}/players`}
                                    className="block w-full px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-center text-sm"
                                >
                                    選手管理
                                </Link>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalCount > limit && (
                    <div className="mt-8 pt-6 border-t border-[var(--color-border-base)]">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-[var(--color-text-muted)]">
                                全{totalCount}チーム中、{(page - 1) * limit + 1}〜{Math.min(page * limit, totalCount)}件を表示
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
                                    onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / limit), p + 1))}
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

                {/* Summary */}
                {!loading && teams.length > 0 && totalCount <= limit && (
                    <div className="mt-8 pt-6 border-t border-[var(--color-border-base)]">
                        <p className="text-sm text-[var(--color-text-muted)] text-center">
                            全{totalCount}チーム中、{filteredTeams.length}チームを表示
                        </p>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
