'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Breadcrumbs from '@/components/Breadcrumbs';
import TournamentSubNav from '@/components/TournamentSubNav';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { createClient } from '@/lib/supabase/client';

interface Match {
    id: string;
    round_name: string;
    match_number: number;
    status: 'pending' | 'inprogress' | 'finished';
    court_number: number | null;
    match_scores?: {
        game_count_a: number;
        game_count_b: number;
    };
    match_pairs?: Array<{
        id: string;
        pair_number: number;
        teams?: {
            name: string;
        };
    }>;
}

interface Tournament {
    id: string;
    name: string;
}

export default function LivePage() {
    const params = useParams();
    const tournamentId = params.id as string;

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
    const supabase = useMemo(() => createClient(), []);

    const fetchData = useCallback(async () => {
        try {
            const [tournamentRes, matchesRes] = await Promise.all([
                fetch(`/api/tournaments/${tournamentId}`),
                fetch(`/api/scoring/live?tournament_id=${tournamentId}`),
            ]);

            const [tournamentData, matchesData] = await Promise.all([
                tournamentRes.json(),
                matchesRes.json(),
            ]);

            if (tournamentRes.ok) {
                setTournament(tournamentData);
            }
            if (matchesRes.ok) {
                setMatches(matchesData.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch live matches:', err);
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Supabase Realtime購読
    useEffect(() => {
        if (!tournamentId) return;

        // 試合の変更を購読
        const matchesChannel = supabase
            .channel(`tournament:${tournamentId}:matches`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'matches',
                    filter: `tournament_id=eq.${tournamentId}`,
                },
                (payload) => {
                    // 試合ステータス変更時に更新
                    const newRecord = payload.new as Record<string, unknown> | undefined;
                    if (newRecord && (newRecord.status === 'inprogress' || newRecord.status === 'finished')) {
                        fetchData();
                    }
                }
            )
            .subscribe();

        // スコアの変更を購読
        const scoresChannel = supabase
            .channel(`tournament:${tournamentId}:scores`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'match_scores',
                },
                (payload) => {
                    // 該当試合のスコアを更新
                    const newScore = payload.new as Record<string, unknown> | undefined;
                    if (!newScore || !newScore.match_id) return;
                    setMatches((prev) =>
                        prev.map((m) =>
                            m.id === newScore.match_id
                                ? {
                                      ...m,
                                      match_scores: {
                                          game_count_a: newScore.game_count_a as number,
                                          game_count_b: newScore.game_count_b as number,
                                      },
                                  }
                                : m
                        )
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(matchesChannel);
            supabase.removeChannel(scoresChannel);
        };
    }, [tournamentId, supabase, fetchData]);

    const liveMatches = useMemo(
        () => matches.filter((m) => m.status === 'inprogress' || m.status === 'finished'),
        [matches]
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <LoadingSpinner />
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
                            { label: 'リアルタイム観戦' },
                        ]}
                    />
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                                リアルタイム観戦
                            </h1>
                            {tournament && <p className="text-slate-400 mt-2">{tournament.name}</p>}
                            <p className="text-slate-500 text-sm mt-1">リアルタイム更新</p>
                        </div>
                            <button
                                onClick={fetchData}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                更新
                            </button>
                    </div>
                    </div>

                <TournamentSubNav tournamentId={tournamentId} />

                {/* Live Matches */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {liveMatches.map((match) => {
                        const isExpanded = expandedMatchId === match.id;
                        return (
                            <div
                                key={match.id}
                                onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                                className={`p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border transition-all cursor-pointer ${
                                    isExpanded ? 'border-red-500' : 'border-slate-700/50 hover:border-red-500'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-white font-medium">{match.round_name}</p>
                                        <p className="text-slate-400 text-sm">試合 #{match.match_number}</p>
                                    </div>
                                    {match.court_number && (
                                        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">
                                            コート {match.court_number}
                                        </span>
                                    )}
                                </div>
                                {match.match_pairs && match.match_pairs.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        <div className="text-white font-medium">
                                            {match.match_pairs[0]?.teams?.name || 'チームA'}
                                        </div>
                                        <div className="text-slate-400 text-sm">vs</div>
                                        <div className="text-white font-medium">
                                            {match.match_pairs.length >= 2 ? (match.match_pairs[1]?.teams?.name || 'チームB') : 'チームB'}
                                        </div>
                                    </div>
                                )}
                                {match.match_scores && (
                                    <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-700">
                                        <span className="text-3xl font-bold text-red-400">
                                            {match.match_scores.game_count_a}
                                        </span>
                                        <span className="text-slate-400">-</span>
                                        <span className="text-3xl font-bold text-red-400">
                                            {match.match_scores.game_count_b}
                                        </span>
                                    </div>
                                )}
                                <div className="mt-4 flex justify-center">
                                    <span
                                        className={`px-3 py-1 text-xs rounded ${
                                            match.status === 'finished'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-blue-500/20 text-blue-400 animate-pulse'
                                        }`}
                                    >
                                        {match.status === 'finished' ? '終了' : '進行中'}
                                    </span>
                                </div>

                                {/* Expanded Detail */}
                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                                        {match.match_pairs && match.match_pairs.length > 0 && (
                                            <div>
                                                <p className="text-slate-400 text-xs mb-2">対戦チーム</p>
                                                {match.match_pairs.map((pair, idx) => (
                                                    <div key={pair.id} className="flex items-center gap-2 text-sm text-white">
                                                        <span className="text-slate-500">#{pair.pair_number}</span>
                                                        <span>{pair.teams?.name || `チーム${idx + 1}`}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {!match.match_scores && (
                                            <p className="text-slate-500 text-sm">スコアはまだ記録されていません</p>
                                        )}
                                        <p className="text-slate-500 text-xs text-center">タップで閉じる</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {liveMatches.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">現在進行中の試合はありません</p>
                    </div>
                )}
            </div>
        </div>
    );
}

