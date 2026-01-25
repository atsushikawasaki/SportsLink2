'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, Download, RotateCcw, Edit, CheckCircle } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Breadcrumbs from '@/components/Breadcrumbs';
import PDFExportButton from '@/components/PDFExportButton';

interface Match {
    id: string;
    round_name: string;
    match_number: number;
    status: 'pending' | 'inprogress' | 'finished';
    is_confirmed?: boolean;
    match_scores?: {
        game_count_a: number;
        game_count_b: number;
        final_score: string | null;
    };
    match_pairs?: Array<{
        id: string;
        pair_number: number;
        teams?: {
            name: string;
            school_name: string;
        };
    }>;
}

export default function ResultsPage() {
    const params = useParams();
    const router = useRouter();
    const tournamentId = params.id as string;

    const [tournament, setTournament] = useState<any>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'inprogress' | 'finished'>('all');
    const [roundFilter, setRoundFilter] = useState<string>('all');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // 大会情報取得
            const tournamentRes = await fetch(`/api/tournaments/${tournamentId}`);
            const tournamentData = await tournamentRes.json();
            if (tournamentRes.ok) {
                setTournament(tournamentData);
            }

            // 試合一覧取得（サーバーサイドフィルタリング）
            const params = new URLSearchParams();
            params.append('status', 'finished');
            if (statusFilter !== 'all') {
                params.set('status', statusFilter);
            }
            if (roundFilter !== 'all') {
                params.append('round', roundFilter);
            }
            if (searchQuery) {
                params.append('search', searchQuery);
            }

            const matchesRes = await fetch(`/api/tournaments/${tournamentId}/matches?${params.toString()}`);
            const matchesData = await matchesRes.json();
            if (matchesRes.ok) {
                setMatches(matchesData.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [tournamentId, statusFilter, roundFilter, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData, statusFilter, roundFilter, searchQuery]);

    const handleRevert = useCallback(async (matchId: string) => {
        if (!confirm('この操作により、スコアの修正が可能になります。確定済みの試合も差し戻せます。続行しますか？')) {
            return;
        }

        try {
            const response = await fetch(`/api/matches/${matchId}/revert`, {
                method: 'POST',
            });

            const result = await response.json();
            if (!response.ok) {
                alert(result.error || '試合の差し戻しに失敗しました');
                return;
            }

            alert('試合を差し戻しました');
            fetchData();
        } catch (err) {
            alert('試合の差し戻しに失敗しました');
        }
    }, [fetchData]);

    const handleConfirm = useCallback(async (matchId: string) => {
        if (!confirm('試合を確定しますか？確定後はスコアの変更ができなくなります。')) {
            return;
        }

        try {
            const response = await fetch(`/api/matches/${matchId}/confirm`, {
                method: 'POST',
            });

            const result = await response.json();
            if (!response.ok) {
                alert(result.error || '試合の確定に失敗しました');
                return;
            }

            alert('試合を確定しました');
            fetchData();
        } catch (err) {
            alert('試合の確定に失敗しました');
        }
    }, [fetchData]);

    const handleDirectScoreEdit = useCallback(async (matchId: string) => {
        const match = matches.find((m) => m.id === matchId);
        if (match?.is_confirmed) {
            alert('確定済みの試合はスコアを修正できません。先に差し戻してください。');
            return;
        }

        const gameCountA = prompt('チームAのゲームカウントを入力してください:');
        const gameCountB = prompt('チームBのゲームカウントを入力してください:');

        if (gameCountA === null || gameCountB === null) {
            return;
        }

        if (!confirm('スコアを直接修正しますか？')) {
            return;
        }

        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/score`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_count_a: parseInt(gameCountA),
                    game_count_b: parseInt(gameCountB),
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                alert(result.error || 'スコアの修正に失敗しました');
                return;
            }

            alert('スコアを修正しました');
            fetchData();
        } catch (err) {
            alert('スコアの修正に失敗しました');
        }
    }, [matches, fetchData]);

    const handleCSVExport = useCallback(async () => {
        try {
            const response = await fetch(`/api/tournaments/${tournamentId}/results/export`);
            if (!response.ok) {
                alert('CSVエクスポートに失敗しました');
                return;
            }

            const data = await response.json();
            // CSV形式に変換
            const csvHeader = 'ラウンド,試合番号,チームA,チームB,スコアA,スコアB,最終スコア\n';
            const csvRows = data.matches?.map((match: any) => {
                const teamA = match.match_pairs?.[0]?.teams?.name || 'N/A';
                const teamB = match.match_pairs?.[1]?.teams?.name || 'N/A';
                const scores = Array.isArray(match.match_scores) ? match.match_scores[0] : match.match_scores;
                return `${match.round_name},${match.match_number},${teamA},${teamB},${scores?.game_count_a || 0},${scores?.game_count_b || 0},${scores?.final_score || ''}\n`;
            }).join('') || '';

            const csvContent = csvHeader + csvRows;
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tournament-${tournamentId}-results.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert('CSVエクスポートに失敗しました');
        }
    }, [tournamentId]);

    // サーバーサイドでフィルタリングされているため、フロントエンドでのフィルタリングは不要
    const filteredMatches = useMemo(() => matches, [matches]);

    const uniqueRounds = useMemo(() => {
        return Array.from(new Set(matches.map((m) => m.round_name)));
    }, [matches]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <AppHeader />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <Breadcrumbs
                        items={[
                            { label: '大会一覧', href: '/tournaments' },
                            { label: tournament?.name || '大会詳細', href: `/tournaments/${tournamentId}` },
                            { label: '試合結果' },
                        ]}
                    />
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                                試合結果
                            </h1>
                            {tournament && <p className="text-slate-400 mt-2">{tournament.name}</p>}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCSVExport}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                CSVエクスポート
                            </button>
                            <PDFExportButton tournamentId={tournamentId} />
                        </div>
                    </div>
                </header>

                {/* Filters */}
                <div className="mb-6 flex flex-wrap gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ラウンド名・チーム名で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="all">すべてのステータス</option>
                            <option value="pending">待機中</option>
                            <option value="inprogress">進行中</option>
                            <option value="finished">終了</option>
                        </select>
                    </div>
                    <select
                        value={roundFilter}
                        onChange={(e) => setRoundFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                        <option value="all">すべてのラウンド</option>
                        {uniqueRounds.map((round) => (
                            <option key={round} value={round}>
                                {round}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Matches List */}
                <div className="space-y-4">
                    {filteredMatches.map((match) => (
                        <div
                            key={match.id}
                            className="p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-4 mb-2">
                                        <p className="text-white font-medium">{match.round_name}</p>
                                        <p className="text-slate-400 text-sm">試合 #{match.match_number}</p>
                                    </div>
                                    {match.match_pairs && match.match_pairs.length > 0 && (
                                        <div className="flex items-center gap-4 mb-2">
                                            <p className="text-white">
                                                {match.match_pairs[0]?.teams?.name || 'チームA'}
                                            </p>
                                            <span className="text-slate-400">vs</span>
                                            <p className="text-white">
                                                {match.match_pairs[1]?.teams?.name || 'チームB'}
                                            </p>
                                        </div>
                                    )}
                                    {match.match_scores && (
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl font-bold text-cyan-400">
                                                {Array.isArray(match.match_scores) 
                                                    ? match.match_scores[0]?.game_count_a || 0
                                                    : match.match_scores.game_count_a || 0}
                                            </span>
                                            <span className="text-slate-400">-</span>
                                            <span className="text-2xl font-bold text-cyan-400">
                                                {Array.isArray(match.match_scores)
                                                    ? match.match_scores[0]?.game_count_b || 0
                                                    : match.match_scores.game_count_b || 0}
                                            </span>
                                            {(Array.isArray(match.match_scores) 
                                                ? match.match_scores[0]?.final_score
                                                : match.match_scores.final_score) && (
                                                <span className="text-slate-400 text-sm">
                                                    ({Array.isArray(match.match_scores)
                                                        ? match.match_scores[0]?.final_score
                                                        : match.match_scores.final_score})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Link
                                        href={`/matches/${match.id}`}
                                        className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                                    >
                                        詳細
                                    </Link>
                                    {match.status === 'finished' && !match.is_confirmed && (
                                        <button
                                            onClick={() => handleConfirm(match.id)}
                                            className="flex items-center gap-1 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            確定
                                        </button>
                                    )}
                                    {match.status === 'finished' && match.is_confirmed && (
                                        <span className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm">
                                            確定済み
                                        </span>
                                    )}
                                    {match.status === 'finished' && (
                                        <>
                                            <button
                                                onClick={() => handleRevert(match.id)}
                                                className="flex items-center gap-1 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors text-sm"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                差し戻し
                                            </button>
                                            {!match.is_confirmed && (
                                                <button
                                                    onClick={() => handleDirectScoreEdit(match.id)}
                                                    className="flex items-center gap-1 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                    スコア修正
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredMatches.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">条件に一致する試合がありません</p>
                    </div>
                )}
            </div>
        </div>
    );
}

