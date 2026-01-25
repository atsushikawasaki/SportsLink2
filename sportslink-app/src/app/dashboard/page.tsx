'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Users, Calendar, Plus, ArrowRight, Play, Clock, Award } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { SkeletonCard, SkeletonList } from '@/components/Skeleton';

interface Tournament {
    id: string;
    name: string;
    status: 'draft' | 'published' | 'finished';
    is_public: boolean;
    created_at: string;
}

interface Match {
    id: string;
    round_name: string;
    match_number: number;
    status: 'pending' | 'inprogress' | 'finished';
    tournaments?: {
        id: string;
        name: string;
    };
    match_pairs?: Array<{
        teams?: {
            name: string;
        };
    }>;
}

export default function DashboardPage() {
    const { user, isAuthenticated, setLoading } = useAuthStore();
    const router = useRouter();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [assignedMatches, setAssignedMatches] = useState<Match[]>([]);
    const [loading, setLoadingState] = useState(true);
    const [tournamentStats, setTournamentStats] = useState({
        managed: 0,
        entered: 0,
        public: 0,
    });

    const checkConsentStatus = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const response = await fetch('/api/auth/consent/check');
            const result = await response.json();
            if (response.ok && result.needs_reconsent) {
                router.push('/consent');
            }
        } catch (err) {
            // エラーは無視（規約チェックの失敗でダッシュボードをブロックしない）
            console.error('Consent check error:', err);
        }
    }, [isAuthenticated, router]);

    const fetchTournaments = useCallback(async () => {
        try {
            // 並列でデータ取得（Promise.all）
            const promises: Promise<any>[] = [
                // 大会一覧取得（表示分のみ）
                fetch('/api/tournaments?limit=5').then((res) => res.json()),
            ];

            // 審判割り当て試合取得（ユーザーがいる場合のみ）
            if (user?.id) {
                promises.push(
                    fetch(`/api/matches/umpire/${user.id}`)
                        .then((res) => res.json())
                        .catch((err) => {
                            console.error('Error fetching umpire matches:', err);
                            return { data: [], error: null };
                        })
                );
            }

            const [tournamentsResult, matchesResult] = await Promise.all(promises);

            // 大会一覧の処理
            if (tournamentsResult.data) {
                const allTournaments = tournamentsResult.data || [];
                setTournaments(allTournaments);

                // 大会サマリー計算
                const managed = allTournaments.length;
                const entered = allTournaments.filter(
                    (t: Tournament) => t.status === 'published' || t.status === 'finished'
                ).length;
                const publicCount = allTournaments.filter(
                    (t: Tournament) => t.is_public && t.status === 'published'
                ).length;

                setTournamentStats({
                    managed,
                    entered,
                    public: publicCount,
                });
            }

            // 審判割り当て試合の処理
            if (matchesResult && matchesResult.data) {
                const matches = matchesResult.data || [];
                // 進行中・待機中の試合のみ表示
                const activeMatches = matches.filter(
                    (m: Match) => m.status === 'inprogress' || m.status === 'pending'
                );
                setAssignedMatches(activeMatches.slice(0, 5));
            } else if (matchesResult?.error) {
                // エラーが発生した場合でもアプリケーションを続行
                console.error('Failed to fetch umpire matches:', matchesResult);
                // RLS無限再帰エラーの場合は特別なメッセージを表示
                if (matchesResult.details?.code === '42P17') {
                    console.warn('RLS infinite recursion detected. Please apply migration 014.');
                }
                setAssignedMatches([]);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoadingState(false);
        }
    }, [user?.id]);

    useEffect(() => {
        setLoading(false);
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        fetchTournaments();
        checkConsentStatus();
    }, [isAuthenticated, router, setLoading, fetchTournaments, checkConsentStatus]);

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <AppHeader />

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">
                        こんにちは、{user?.display_name || 'ユーザー'}さん
                    </h2>
                    <p className="text-slate-400">ダッシュボードへようこそ</p>
                </div>

                {/* Tournament Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="p-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm mb-1">管理する大会数</p>
                                <p className="text-3xl font-bold text-white">{tournamentStats.managed}</p>
                            </div>
                            <Trophy className="w-12 h-12 text-blue-400 opacity-50" />
                        </div>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm mb-1">エントリー中の大会数</p>
                                <p className="text-3xl font-bold text-white">{tournamentStats.entered}</p>
                            </div>
                            <Calendar className="w-12 h-12 text-green-400 opacity-50" />
                        </div>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm mb-1">公開されている大会数</p>
                                <p className="text-3xl font-bold text-white">{tournamentStats.public}</p>
                            </div>
                            <Award className="w-12 h-12 text-purple-400 opacity-50" />
                        </div>
                    </div>
                </div>

                {/* Assigned Matches Section */}
                {assignedMatches.length > 0 && (
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 mb-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-white">審判割り当て試合</h3>
                            <Link
                                href="/assigned-matches"
                                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                すべて見る
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {assignedMatches.map((match) => (
                                <Link
                                    key={match.id}
                                    href={`/matches/${match.id}`}
                                    className="block p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-white font-medium">
                                                    {match.tournaments?.name || '大会'}
                                                </p>
                                                <span className="text-slate-400 text-sm">{match.round_name}</span>
                                            </div>
                                            {match.match_pairs && match.match_pairs.length > 0 && (
                                                <p className="text-slate-300 text-sm">
                                                    {match.match_pairs[0]?.teams?.name || 'チームA'} vs{' '}
                                                    {match.match_pairs[1]?.teams?.name || 'チームB'}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={`px-3 py-1 text-xs rounded ${
                                                    match.status === 'inprogress'
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : 'bg-slate-500/20 text-slate-400'
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
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
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
                                <h3 className="text-lg font-semibold text-white">新規大会作成</h3>
                                <p className="text-sm text-slate-400">新しい大会を作成する</p>
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
                                <h3 className="text-lg font-semibold text-white">大会一覧</h3>
                                <p className="text-sm text-slate-400">大会を管理する</p>
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
                                <h3 className="text-lg font-semibold text-white">チーム管理</h3>
                                <p className="text-sm text-slate-400">チームを管理する</p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Recent Tournaments */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-white">最近の大会</h3>
                        <Link
                            href="/tournaments"
                            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            すべて見る
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {loading ? (
                        <SkeletonList count={5} />
                    ) : tournaments.length === 0 ? (
                        <div className="text-center py-8">
                            <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                            <p className="text-slate-400">まだ大会がありません</p>
                            <Link
                                href="/tournaments/new"
                                className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                最初の大会を作成
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tournaments.map((tournament) => (
                                <TournamentCard key={tournament.id} tournament={tournament} />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// TournamentCardコンポーネントをメモ化
interface TournamentCardProps {
    tournament: Tournament;
}

const TournamentCard = memo(({ tournament }: TournamentCardProps) => {
    return (
        <Link
            href={`/tournaments/${tournament.id}`}
            className="block p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-lg font-medium text-white">{tournament.name}</h4>
                    <p className="text-sm text-slate-400">
                        {new Date(tournament.created_at).toLocaleDateString('ja-JP')}
                    </p>
                </div>
                <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                        tournament.status === 'published'
                            ? 'bg-green-500/20 text-green-400'
                            : tournament.status === 'finished'
                            ? 'bg-slate-500/20 text-slate-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                >
                    {tournament.status === 'published'
                        ? '公開中'
                        : tournament.status === 'finished'
                        ? '終了'
                        : '下書き'}
                </span>
            </div>
        </Link>
    );
});

TournamentCard.displayName = 'TournamentCard';
