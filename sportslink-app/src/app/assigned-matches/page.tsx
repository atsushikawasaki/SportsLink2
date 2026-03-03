'use client';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import Link from 'next/link';
import { Trophy, Play, Eye } from 'lucide-react';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import Breadcrumbs from '@/components/Breadcrumbs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useUmpireMatches } from '@/lib/hooks/queries/useMatches';

export default function AssignedMatchesPage() {
    const { user, isAuthenticated } = useAuthStore();
    const { data, isLoading, error, refetch } = useUmpireMatches(user?.id);

    const matches = data?.data ?? [];

    if (!isAuthenticated) {
        return null;
    }

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <Breadcrumbs items={[{ label: '担当試合一覧' }]} />
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mt-2">
                        担当試合一覧
                    </h1>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-400 mb-4">{(error as Error).message}</p>
                        <button
                            onClick={() => refetch()}
                            className="px-4 py-3 min-h-[48px] bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[var(--color-bg-surface)]"
                        >
                            再試行
                        </button>
                    </div>
                ) : matches.length === 0 ? (
                    <EmptyState
                        icon={Trophy}
                        title="担当試合がありません"
                        description="大会管理者に担当割り当てを依頼するか、大会一覧で役割を確認してください"
                        action={
                            <Link
                                href="/tournaments"
                                className="inline-flex items-center justify-center px-6 py-3 min-h-[48px] bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[var(--color-bg-surface)]"
                            >
                                大会一覧へ
                            </Link>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {matches.map((match) => (
                            <div
                                key={match.id}
                                className="p-6 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] hover:border-[var(--color-border-base)] transition-all"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-[var(--color-text-primary)] font-medium">
                                            {match.tournaments?.name || '大会'}
                                        </p>
                                        <p className="text-[var(--color-text-muted)] text-sm">{match.round_name}</p>
                                        <p className="text-[var(--color-text-muted)] text-xs">試合 #{match.match_number}</p>
                                    </div>
                                    <span
                                        className={`px-3 py-1 text-xs rounded-lg ${
                                            match.status === 'finished'
                                                ? 'bg-green-500/20 text-green-400'
                                                : match.status === 'inprogress'
                                                ? 'bg-blue-500/20 text-blue-400'
                                                : 'bg-slate-500/20 text-slate-400'
                                        }`}
                                    >
                                        {match.status === 'finished'
                                            ? '終了'
                                            : match.status === 'inprogress'
                                            ? '進行中'
                                            : '待機中'}
                                    </span>
                                </div>
                                {match.match_pairs && match.match_pairs.length > 0 && (
                                    <div className="mb-4 space-y-2">
                                        <div className="text-[var(--color-text-primary)]">
                                            {match.match_pairs[0]?.teams?.name || 'チームA'}
                                        </div>
                                        <div className="text-[var(--color-text-muted)] text-sm">vs</div>
                                        <div className="text-[var(--color-text-primary)]">
                                            {match.match_pairs.length >= 2
                                                ? (match.match_pairs[1]?.teams?.name || 'チームB')
                                                : 'チームB'}
                                        </div>
                                    </div>
                                )}
                                {match.match_scores && (
                                    <div className="flex items-center justify-center gap-4 mb-4 pt-4 border-t border-[var(--color-border-base)]">
                                        <span className="text-2xl font-bold text-brand">
                                            {match.match_scores.game_count_a}
                                        </span>
                                        <span className="text-[var(--color-text-muted)]">-</span>
                                        <span className="text-2xl font-bold text-brand">
                                            {match.match_scores.game_count_b}
                                        </span>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    {match.status === 'pending' && (
                                        <Link
                                            href={`/scoring/${match.id}`}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors text-sm"
                                        >
                                            <Play className="w-4 h-4" />
                                            試合開始
                                        </Link>
                                    )}
                                    {match.status === 'inprogress' && (
                                        <Link
                                            href={`/scoring/${match.id}`}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                                        >
                                            スコア入力
                                        </Link>
                                    )}
                                    <Link
                                        href={`/matches/${match.id}`}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-surface-2)] transition-colors text-sm"
                                    >
                                        <Eye className="w-4 h-4" />
                                        詳細
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
