'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Users, Calendar, Plus, ArrowRight, Play, Clock, Award, ChevronRight } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { SkeletonList } from '@/components/Skeleton';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useDashboard } from '@/lib/hooks/queries/useDashboard';

interface Tournament {
    id: string;
    name: string;
    status: 'draft' | 'published' | 'finished';
    is_public: boolean;
    created_at: string;
}

export default function DashboardPage() {
    const { user, isAuthenticated, setLoading: setAuthLoading } = useAuthStore();
    const router = useRouter();
    const { isLoading, tournaments, assignedMatches, needsReconsent, tournamentStats } =
        useDashboard(user?.id);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        setAuthLoading(false);
    }, [isAuthenticated, router, setAuthLoading]);

    useEffect(() => {
        if (needsReconsent) {
            router.push('/consent');
        }
    }, [needsReconsent, router]);

    if (!isAuthenticated) {
        return (
            <div className="bg-[var(--color-bg-primary)] flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="mt-4 text-[var(--color-text-muted)]">認証を確認しています...</p>
                </div>
            </div>
        );
    }

    const SkeletonStatCard = () => (
        <div className="p-6 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] animate-pulse">
            <div className="flex items-center justify-between">
                <div>
                    <div className="h-4 w-24 bg-[var(--color-bg-surface-2)] rounded mb-2"></div>
                    <div className="h-8 w-12 bg-[var(--color-bg-surface-2)] rounded"></div>
                </div>
                <div className="w-12 h-12 bg-[var(--color-bg-surface-2)] rounded-lg"></div>
            </div>
        </div>
    );

    const inProgressCount = assignedMatches.filter((m) => m.status === 'inprogress').length;
    const pendingCount = assignedMatches.filter((m) => m.status === 'pending').length;

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                        こんにちは、{user?.display_name || 'ユーザー'}さん
                    </h2>
                    <p className="text-[var(--color-text-muted)]">ダッシュボードへようこそ</p>
                </div>

                {!isLoading && (() => {
                    if (inProgressCount > 0) {
                        return (
                            <Link
                                href="/assigned-matches"
                                className="block mb-8 p-4 rounded-xl border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-blue-400 font-medium">次にやること</p>
                                        <p className="text-[var(--color-text-primary)] mt-1">
                                            進行中の試合が{inProgressCount}件あります。スコア入力を続けましょう
                                        </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-blue-400 shrink-0" />
                                </div>
                            </Link>
                        );
                    }
                    if (pendingCount > 0) {
                        return (
                            <Link
                                href="/assigned-matches"
                                className="block mb-8 p-4 rounded-xl border border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-cyan-400 font-medium">次にやること</p>
                                        <p className="text-[var(--color-text-primary)] mt-1">
                                            {pendingCount}試合のスコア入力が可能です
                                        </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-cyan-400 shrink-0" />
                                </div>
                            </Link>
                        );
                    }
                    if (tournaments.length === 0) {
                        return (
                            <Link
                                href="/tournaments/new"
                                className="block mb-8 p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-amber-400 font-medium">次にやること</p>
                                        <p className="text-[var(--color-text-primary)] mt-1">最初の大会を作成しましょう</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-amber-400 shrink-0" />
                                </div>
                            </Link>
                        );
                    }
                    return null;
                })()}

                {assignedMatches.length > 0 && (
                    <div className="mb-8">
                        <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">審判割り当て試合</h3>
                                <Link
                                    href="/assigned-matches"
                                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    すべて見る
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                            <div className="space-y-3">
                                {assignedMatches
                                    .sort((a, b) => {
                                        const order = { inprogress: 0, pending: 1, finished: 2 };
                                        return (order[a.status] ?? 2) - (order[b.status] ?? 2);
                                    })
                                    .map((match) => (
                                        <div
                                            key={match.id}
                                            className="flex items-center gap-3 p-4 bg-[var(--color-bg-surface-2)]/50 rounded-lg"
                                        >
                                            <Link
                                                href={`/matches/${match.id}`}
                                                className="flex-1 min-w-0 hover:opacity-90 transition-opacity"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="text-[var(--color-text-primary)] font-medium truncate">
                                                                {match.tournaments?.name || '大会'}
                                                            </p>
                                                            <span className="text-[var(--color-text-muted)] text-sm shrink-0">
                                                                {match.round_name}
                                                            </span>
                                                        </div>
                                                        {match.match_pairs && match.match_pairs.length > 0 && (
                                                            <p className="text-[var(--color-text-secondary)] text-sm truncate">
                                                                {match.match_pairs[0]?.teams?.name || 'チームA'} vs{' '}
                                                                {match.match_pairs.length >= 2
                                                                    ? (match.match_pairs[1]?.teams?.name || 'チームB')
                                                                    : 'チームB'}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span
                                                        className={`px-3 py-1 text-xs rounded shrink-0 ${
                                                            match.status === 'inprogress'
                                                                ? 'bg-blue-500/20 text-blue-400'
                                                                : 'bg-slate-500/20 text-[var(--color-text-muted)]'
                                                        }`}
                                                    >
                                                        {match.status === 'inprogress' ? (
                                                            <>
                                                                <Play className="w-3 h-3 inline mr-1" />
                                                                進行中
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Clock className="w-3 h-3 inline mr-1" />
                                                                待機中
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            </Link>
                                            {(match.status === 'inprogress' || match.status === 'pending') && (
                                                <Link
                                                    href={`/scoring/${match.id}`}
                                                    className="shrink-0 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors"
                                                >
                                                    {match.status === 'inprogress' ? 'スコア入力' : '試合開始'}
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {isLoading ? (
                        <>
                            <SkeletonStatCard />
                            <SkeletonStatCard />
                            <SkeletonStatCard />
                        </>
                    ) : (
                        <>
                            <div className="p-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[var(--color-text-muted)] text-sm mb-1">管理する大会数</p>
                                        <p className="text-3xl font-bold text-[var(--color-text-primary)]">{tournamentStats.managed}</p>
                                    </div>
                                    <Trophy className="w-12 h-12 text-blue-400 opacity-50" />
                                </div>
                            </div>
                            <div className="p-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[var(--color-text-muted)] text-sm mb-1">エントリー中の大会数</p>
                                        <p className="text-3xl font-bold text-[var(--color-text-primary)]">{tournamentStats.entered}</p>
                                    </div>
                                    <Calendar className="w-12 h-12 text-green-400 opacity-50" />
                                </div>
                            </div>
                            <div className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[var(--color-text-muted)] text-sm mb-1">公開されている大会数</p>
                                        <p className="text-3xl font-bold text-[var(--color-text-primary)]">{tournamentStats.public}</p>
                                    </div>
                                    <Award className="w-12 h-12 text-purple-400 opacity-50" />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Link
                        href="/tournaments/new"
                        className="group p-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                                <Plus className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">新規大会作成</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">新しい大会を作成する</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/tournaments"
                        className="group p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                                <Trophy className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">大会一覧</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">大会を管理する</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/teams"
                        className="group p-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30 hover:border-green-400/50 transition-all duration-300"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                                <Users className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">チーム管理</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">チームを管理する</p>
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">最近の大会</h3>
                        <Link
                            href="/tournaments"
                            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            すべて見る
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {isLoading ? (
                        <SkeletonList count={5} />
                    ) : tournaments.length === 0 ? (
                        <div className="text-center py-8">
                            <Calendar className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
                            <p className="text-[var(--color-text-muted)]">まだ大会がありません</p>
                            <Link
                                href="/tournaments/new"
                                className="inline-block mt-4 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
                            >
                                最初の大会を作成
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[var(--color-border-base)]">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">大会名</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">ステータス</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">作成日</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tournaments.map((tournament: Tournament) => (
                                        <tr key={tournament.id} className="border-b border-[var(--color-border-base)]/50 hover:bg-[var(--color-bg-surface-2)] transition-colors">
                                            <td className="py-3 px-4">
                                                <span className="font-medium text-[var(--color-text-primary)]">{tournament.name}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                    tournament.status === 'published' ? 'bg-green-500/20 text-green-400' :
                                                    tournament.status === 'finished' ? 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-muted)]' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {tournament.status === 'published' ? '公開中' : tournament.status === 'finished' ? '終了' : '下書き'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-[var(--color-text-muted)]">
                                                {new Date(tournament.created_at).toLocaleDateString('ja-JP')}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Link href={`/tournaments/${tournament.id}`} className="text-sm text-brand hover:text-brand-hover transition-colors">
                                                    詳細
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
