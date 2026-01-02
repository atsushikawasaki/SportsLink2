'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import Link from 'next/link';
import { ArrowRight, Clock, Play, CheckCircle, Search, Filter } from 'lucide-react';

interface Team {
    id: string;
    name: string;
    school_name: string;
}

interface MatchPair {
    id: string;
    pair_number: number;
    team_id: string;
    teams: Team | null;
}

interface Tournament {
    id: string;
    name: string;
}

interface Match {
    id: string;
    tournament_id: string;
    round_name: string;
    status: 'pending' | 'inprogress' | 'finished';
    umpire_id: string;
    court_number: number | null;
    started_at: string | null;
    match_scores: {
        game_count_a: number;
        game_count_b: number;
        final_score: string | null;
    }[];
    tournaments: Tournament | null;
    match_pairs?: MatchPair[];
}

export default function ScoringListPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'inprogress' | 'finished'>('all');
    const [tournamentFilter, setTournamentFilter] = useState<string>('all');

    useEffect(() => {
        if (!isAuthenticated || !user) {
            router.push('/login');
            return;
        }

        fetchMatches();
    }, [isAuthenticated, user, router]);

    const fetchMatches = async () => {
        try {
            setLoading(true);
            setError(null);

            // 審判の担当試合一覧を取得
            const response = await fetch(`/api/matches/umpire/${user.id}`);

            if (!response.ok) {
                const result = await response.json();
                setError(result.error || '試合一覧の取得に失敗しました');
                return;
            }

            const result = await response.json();
            setMatches(result.data || []);
        } catch (err) {
            console.error('Failed to fetch matches:', err);
            setError('試合一覧の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded-full">
                        <Clock className="w-3 h-3" />
                        待機中
                    </span>
                );
            case 'inprogress':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full">
                        <Play className="w-3 h-3" />
                        進行中
                    </span>
                );
            case 'finished':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        終了
                    </span>
                );
            default:
                return null;
        }
    };

    const getTeamNames = (match: Match) => {
        const pairs = match.match_pairs || [];
        const teamA = pairs.find((p) => p.pair_number === 1)?.teams;
        const teamB = pairs.find((p) => p.pair_number === 2)?.teams;
        return {
            teamA: teamA?.name || 'チームA',
            teamB: teamB?.name || 'チームB',
        };
    };

    const getScore = (match: Match) => {
        const score = match.match_scores?.[0];
        if (!score) return { scoreA: 0, scoreB: 0 };
        return {
            scoreA: score.game_count_a || 0,
            scoreB: score.game_count_b || 0,
        };
    };

    // フィルター適用
    const filteredMatches = matches.filter((match) => {
        // ステータスフィルター
        if (statusFilter !== 'all' && match.status !== statusFilter) {
            return false;
        }

        // 大会フィルター
        if (tournamentFilter !== 'all' && match.tournament_id !== tournamentFilter) {
            return false;
        }

        // 検索クエリ
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const teamNames = getTeamNames(match);
            const tournamentName = match.tournaments?.name || '';
            return (
                match.round_name.toLowerCase().includes(query) ||
                teamNames.teamA.toLowerCase().includes(query) ||
                teamNames.teamB.toLowerCase().includes(query) ||
                tournamentName.toLowerCase().includes(query)
            );
        }

        return true;
    });

    // 大会一覧（フィルター用）
    const tournaments = Array.from(
        new Set(matches.map((m) => ({ id: m.tournament_id, name: m.tournaments?.name || '不明' })))
    );

    if (!isAuthenticated || !user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-6xl mx-auto px-4">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <Link
                                href="/dashboard"
                                className="flex items-center text-slate-400 hover:text-blue-400 transition-colors"
                            >
                                ← ダッシュボードに戻る
                            </Link>
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                            スコア入力一覧
                        </h1>
                        <p className="text-slate-400">担当試合のスコアを入力・確認できます</p>
                    </div>

                    {/* Filters */}
                    <div className="mb-6 space-y-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="ラウンド名、チーム名、大会名で検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Status and Tournament Filters */}
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-400">ステータス:</span>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                    className="px-3 py-1 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">すべて</option>
                                    <option value="pending">待機中</option>
                                    <option value="inprogress">進行中</option>
                                    <option value="finished">終了</option>
                                </select>
                            </div>

                            {tournaments.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-400">大会:</span>
                                    <select
                                        value={tournamentFilter}
                                        onChange={(e) => setTournamentFilter(e.target.value)}
                                        className="px-3 py-1 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">すべて</option>
                                        {tournaments.map((tournament) => (
                                            <option key={tournament.id} value={tournament.id}>
                                                {tournament.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Matches List */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-400 mb-4">{error}</p>
                            <button
                                onClick={fetchMatches}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                再試行
                            </button>
                        </div>
                    ) : filteredMatches.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-400 text-lg mb-2">
                                {matches.length === 0
                                    ? '担当試合がありません'
                                    : '条件に一致する試合がありません'}
                            </p>
                            {matches.length === 0 && (
                                <Link
                                    href="/dashboard"
                                    className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    ダッシュボードに戻る
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredMatches.map((match) => {
                                const teamNames = getTeamNames(match);
                                const score = getScore(match);

                                return (
                                    <div
                                        key={match.id}
                                        className="p-6 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-slate-500 transition-all"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {getStatusBadge(match.status)}
                                                    <span className="text-sm text-slate-400">
                                                        {match.tournaments?.name || '不明な大会'}
                                                    </span>
                                                </div>
                                                <h3 className="text-lg font-semibold text-white mb-2">
                                                    {match.round_name}
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4 mb-3">
                                                    <div>
                                                        <p className="text-sm text-slate-400 mb-1">チームA</p>
                                                        <p className="text-white font-medium">{teamNames.teamA}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-slate-400 mb-1">チームB</p>
                                                        <p className="text-white font-medium">{teamNames.teamB}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                                    {match.court_number && (
                                                        <span>コート: {match.court_number}</span>
                                                    )}
                                                    {match.started_at && (
                                                        <span>
                                                            開始: {new Date(match.started_at).toLocaleString('ja-JP')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-3 flex-shrink-0">
                                                {/* Score Display */}
                                                <div className="text-center">
                                                    <p className="text-xs text-slate-400 mb-1">スコア</p>
                                                    <div className="text-2xl font-bold text-white">
                                                        {score.scoreA} - {score.scoreB}
                                                    </div>
                                                </div>

                                                {/* Action Button */}
                                                <button
                                                    onClick={() => router.push(`/scoring/${match.id}`)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                                                >
                                                    {match.status === 'finished' ? '結果確認' : 'スコア入力'}
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Summary */}
                    {!loading && matches.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-700">
                            <p className="text-sm text-slate-400 text-center">
                                全{matches.length}試合中、{filteredMatches.length}試合を表示
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

