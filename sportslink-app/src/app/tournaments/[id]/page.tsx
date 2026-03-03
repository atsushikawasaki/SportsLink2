'use client';

import { useState } from 'react';
import { toast, confirmAsync } from '@/lib/toast';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit, Settings, Users, Trophy, Calendar, Play, Award, Eye, Trash2, CheckCircle, Circle } from 'lucide-react';
import AppShell from '@/components/AppShell';
import Breadcrumbs from '@/components/Breadcrumbs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useTournamentDetail } from '@/lib/hooks/queries/useTournamentDetail';
import { useQueryClient } from '@tanstack/react-query';

export default function TournamentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const tournamentId = params.id as string;

    const { tournament, isLoading, error, entryCount, drawTree, refetch } =
        useTournamentDetail(tournamentId);

    const [isPublishing, setIsPublishing] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const flatMatches = (drawTree as { rounds?: Array<{ matches: Array<{ status: string }> }> })?.rounds
        ?.flatMap((r) => r.matches) ?? [];
    const matchCount = flatMatches.length;
    const finishedMatchCount = flatMatches.filter((m) => m.status === 'finished').length;
    const hasDrawGenerated = matchCount > 0;

    const summary = { entryCount, matchCount, finishedMatchCount, hasDrawGenerated };

    const handlePublish = async () => {
        const ok = await confirmAsync({ title: '確認', message: '大会を公開しますか？', confirmLabel: '公開' });
        if (!ok) return;

        try {
            setIsPublishing(true);
            const response = await fetch(`/api/tournaments/${tournamentId}/publish`, {
                method: 'POST',
            });

            if (!response.ok) {
                const result = await response.json();
                toast.error(result.error || '大会の公開に失敗しました');
                return;
            }

            toast.success('大会を公開しました');
            queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
            refetch();
        } catch {
            toast.error('大会の公開に失敗しました');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleFinish = async () => {
        const ok = await confirmAsync({
            title: '確認',
            message: '大会を終了しますか？終了後は変更できません。',
            confirmLabel: '終了',
        });
        if (!ok) return;

        try {
            setIsFinishing(true);
            const response = await fetch(`/api/tournaments/${tournamentId}/finish`, {
                method: 'POST',
            });

            if (!response.ok) {
                const result = await response.json();
                toast.error(result.error || '大会の終了に失敗しました');
                return;
            }

            toast.success('大会を終了しました');
            queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
            refetch();
        } catch {
            toast.error('大会の終了に失敗しました');
        } finally {
            setIsFinishing(false);
        }
    };

    const handleDelete = async () => {
        const ok = await confirmAsync({
            title: '大会を削除',
            message: `「${tournament?.name}」を削除しますか？この操作は取り消せません。`,
            confirmLabel: '削除する',
        });
        if (!ok) return;

        try {
            setIsDeleting(true);
            const response = await fetch(`/api/tournaments/${tournamentId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const result = await response.json();
                toast.error(result.error || '大会の削除に失敗しました');
                return;
            }

            toast.success('大会を削除しました');
            queryClient.invalidateQueries({ queryKey: ['tournaments'] });
            router.push('/tournaments');
        } catch {
            toast.error('大会の削除に失敗しました');
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'published':
                return (
                    <span className="px-3 py-1 text-sm font-medium bg-green-500/20 text-green-400 rounded-full">
                        公開中
                    </span>
                );
            case 'finished':
                return (
                    <span className="px-3 py-1 text-sm font-medium bg-slate-500/20 text-slate-400 rounded-full">
                        終了
                    </span>
                );
            default:
                return (
                    <span className="px-3 py-1 text-sm font-medium bg-yellow-500/20 text-yellow-400 rounded-full">
                        下書き
                    </span>
                );
        }
    };

    const getUmpireModeLabel = (mode: string) => {
        switch (mode) {
            case 'LOSER': return '敗者審判モード';
            case 'ASSIGNED': return '運営割当モード';
            case 'FREE': return 'フリーモード';
            default: return mode;
        }
    };

    const getStepStatus = (stepIndex: number): 'done' | 'current' | 'upcoming' => {
        if (tournament?.status === 'finished') return 'done';
        if (tournament?.status === 'published') {
            if (stepIndex <= 3) return 'done';
            if (stepIndex === 4) return summary.finishedMatchCount > 0 ? 'current' : 'upcoming';
        }
        if (stepIndex === 0) return summary.entryCount > 0 ? 'done' : 'current';
        if (stepIndex === 1) return summary.hasDrawGenerated ? 'done' : summary.entryCount > 0 ? 'current' : 'upcoming';
        if (stepIndex === 2) return summary.hasDrawGenerated ? 'current' : 'upcoming';
        if (stepIndex === 3) return 'upcoming';
        return 'upcoming';
    };

    const steps = [
        { label: 'エントリー', href: `entries` },
        { label: 'ドロー', href: `draw` },
        { label: '割当', href: `assignments` },
        { label: '公開', href: null },
        { label: '結果', href: `results` },
    ];

    if (isLoading) {
        return (
            <div className="bg-[var(--color-bg-primary)] flex items-center justify-center min-h-screen">
                <LoadingSpinner />
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="bg-[var(--color-bg-primary)] py-12 min-h-screen">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-base)] p-8">
                        <p className="text-red-400 text-center mb-4">
                            {error?.message || '大会が見つかりません'}
                        </p>
                        <Link
                            href="/tournaments"
                            className="block text-center text-brand hover:text-brand-hover transition-colors"
                        >
                            大会一覧に戻る
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const progressPct = summary.matchCount > 0
        ? Math.round((summary.finishedMatchCount / summary.matchCount) * 100)
        : 0;

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Breadcrumbs
                        items={[
                            { label: '大会一覧', href: '/tournaments' },
                            { label: tournament.name || '大会詳細' },
                        ]}
                    />
                </div>

                {/* Hero Section */}
                <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-base)] p-8 mb-6">
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                {getStatusBadge(tournament.status)}
                            </div>
                            <h1 className="text-3xl font-display font-bold text-[var(--color-text-primary)] mb-3">
                                {tournament.name}
                            </h1>
                            {tournament.description && (
                                <p className="text-[var(--color-text-secondary)] mb-4">{tournament.description}</p>
                            )}
                            <div className="flex flex-wrap gap-6 text-sm">
                                {tournament.start_date && (
                                    <div>
                                        <p className="text-[var(--color-text-muted)]">開始日</p>
                                        <p className="text-[var(--color-text-primary)]">
                                            {new Date(tournament.start_date).toLocaleDateString('ja-JP')}
                                        </p>
                                    </div>
                                )}
                                {tournament.end_date && (
                                    <div>
                                        <p className="text-[var(--color-text-muted)]">終了日</p>
                                        <p className="text-[var(--color-text-primary)]">
                                            {new Date(tournament.end_date).toLocaleDateString('ja-JP')}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-[var(--color-text-muted)]">審判モード</p>
                                    <p className="text-[var(--color-text-primary)]">{getUmpireModeLabel(tournament.umpire_mode)}</p>
                                </div>
                                {tournament.match_format && (
                                    <div>
                                        <p className="text-[var(--color-text-muted)]">試合形式</p>
                                        <p className="text-[var(--color-text-primary)]">{tournament.match_format}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            <Link
                                href={`/tournaments/${tournamentId}/edit`}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-border-base)] transition-colors"
                            >
                                <Edit className="w-4 h-4" />
                                編集
                            </Link>
                            {tournament.status === 'draft' && (
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                                    title="大会を削除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {summary.matchCount > 0 && (
                        <div className="mb-6">
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-[var(--color-text-muted)]">試合進捗</span>
                                <span className="text-[var(--color-text-secondary)]">
                                    {summary.finishedMatchCount} / {summary.matchCount} 完了 ({progressPct}%)
                                </span>
                            </div>
                            <div className="h-2 bg-[var(--color-bg-surface-2)] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-brand rounded-full transition-all duration-500"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        {tournament.status === 'draft' && (
                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Play className="w-4 h-4" />
                                {isPublishing ? '公開中...' : '大会を公開'}
                            </button>
                        )}
                        {tournament.status === 'published' && (
                            <button
                                onClick={handleFinish}
                                disabled={isFinishing}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Award className="w-4 h-4" />
                                {isFinishing ? '終了中...' : '大会を終了'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Stepper */}
                <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] p-6 mb-6">
                    <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">運営フロー</h2>
                    <div className="flex items-center gap-0">
                        {steps.map((step, idx) => {
                            const status = getStepStatus(idx);
                            const StepContent = () => (
                                <div className="flex flex-col items-center gap-1.5">
                                    {status === 'done' ? (
                                        <CheckCircle className="w-6 h-6 text-green-400" />
                                    ) : status === 'current' ? (
                                        <div className="w-6 h-6 rounded-full border-2 border-brand bg-brand/20 flex items-center justify-center">
                                            <div className="w-2 h-2 rounded-full bg-brand" />
                                        </div>
                                    ) : (
                                        <Circle className="w-6 h-6 text-[var(--color-border-base)]" />
                                    )}
                                    <span className={`text-xs font-medium ${
                                        status === 'done' ? 'text-green-400' :
                                        status === 'current' ? 'text-brand' :
                                        'text-[var(--color-text-muted)]'
                                    }`}>
                                        {step.label}
                                    </span>
                                </div>
                            );

                            return (
                                <div key={step.label} className="flex items-center flex-1">
                                    {step.href ? (
                                        <Link
                                            href={`/tournaments/${tournamentId}/${step.href}`}
                                            className="flex-shrink-0 hover:opacity-80 transition-opacity"
                                        >
                                            <StepContent />
                                        </Link>
                                    ) : (
                                        <div className="flex-shrink-0">
                                            <StepContent />
                                        </div>
                                    )}
                                    {idx < steps.length - 1 && (
                                        <div className={`flex-1 h-0.5 mx-2 ${
                                            getStepStatus(idx) === 'done' ? 'bg-green-400/50' : 'bg-[var(--color-border-base)]'
                                        }`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] p-4 text-center">
                        <p className="text-2xl font-bold text-[var(--color-text-primary)]">{summary.entryCount}</p>
                        <p className="text-[var(--color-text-muted)] text-sm">エントリー</p>
                    </div>
                    <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] p-4 text-center">
                        <p className="text-2xl font-bold text-[var(--color-text-primary)]">{summary.matchCount}</p>
                        <p className="text-[var(--color-text-muted)] text-sm">試合数</p>
                    </div>
                    <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] p-4 text-center">
                        <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                            {summary.matchCount > 0 ? `${summary.finishedMatchCount}/${summary.matchCount}` : '-'}
                        </p>
                        <p className="text-[var(--color-text-muted)] text-sm">完了試合</p>
                    </div>
                </div>

                {/* Navigation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link
                        href={`/tournaments/${tournamentId}/entries`}
                        className="group p-5 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] transition-all"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-brand/20 rounded-lg group-hover:bg-brand/30 transition-colors">
                                <Users className="w-5 h-5 text-brand" />
                            </div>
                            <h3 className="font-semibold text-[var(--color-text-primary)]">エントリー管理</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] text-sm">チーム・選手・ペアの管理</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/draw`}
                        className="group p-5 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] transition-all"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                                <Trophy className="w-5 h-5 text-purple-400" />
                            </div>
                            <h3 className="font-semibold text-[var(--color-text-primary)]">ドロー管理</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] text-sm">ドローの生成・表示</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/assignments`}
                        className="group p-5 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] transition-all"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                                <Calendar className="w-5 h-5 text-green-400" />
                            </div>
                            <h3 className="font-semibold text-[var(--color-text-primary)]">試合割当</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] text-sm">審判・コート番号の割り当て</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/roles`}
                        className="group p-5 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] transition-all"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-yellow-500/20 rounded-lg group-hover:bg-yellow-500/30 transition-colors">
                                <Settings className="w-5 h-5 text-yellow-400" />
                            </div>
                            <h3 className="font-semibold text-[var(--color-text-primary)]">権限管理</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] text-sm">ユーザー権限の設定</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/results`}
                        className="group p-5 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] transition-all"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
                                <Award className="w-5 h-5 text-cyan-400" />
                            </div>
                            <h3 className="font-semibold text-[var(--color-text-primary)]">試合結果</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] text-sm">試合結果の確認・管理</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/live`}
                        className="group p-5 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] transition-all"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-red-500/20 rounded-lg group-hover:bg-red-500/30 transition-colors">
                                <Eye className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="font-semibold text-[var(--color-text-primary)]">リアルタイム観戦</h3>
                        </div>
                        <p className="text-[var(--color-text-muted)] text-sm">ライブ試合の観戦</p>
                    </Link>
                </div>
            </div>
        </AppShell>
    );
}
