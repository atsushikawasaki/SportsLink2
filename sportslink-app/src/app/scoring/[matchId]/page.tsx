'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMatchStore } from '@/features/scoring/hooks/useMatchStore';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useNotificationStore } from '@/features/notifications/hooks/useNotificationStore';
import { ArrowLeft, Undo2, Wifi, WifiOff, Pause, Play } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/client';

interface Team {
    id: string;
    name: string;
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
    umpire_mode: 'LOSER' | 'ASSIGNED' | 'FREE';
}

interface Match {
    id: string;
    tournament_id: string;
    round_name: string;
    status: string;
    umpire_id: string;
    court_number: number;
    version: number;
    match_scores: {
        game_count_a: number;
        game_count_b: number;
    }[];
    match_pairs?: MatchPair[];
    tournaments?: Tournament;
}

export default function ScoringPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.matchId as string;

    const {
        matchStatus,
        gameCountA,
        gameCountB,
        currentScoreA,
        currentScoreB,
        connectionState,
        isSyncing,
        setMatchState,
        updateScore,
        addPointToQueue,
        setConnectionState,
        setSyncing,
        resetMatch,
    } = useMatchStore();

    const { user } = useAuthStore();
    const { getAuthKey, addNotification } = useNotificationStore();
    const [match, setMatch] = useState<Match | null>(null);
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [tokenError, setTokenError] = useState<string | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    const fetchMatch = useCallback(async () => {
        try {
            const response = await fetch(`/api/matches/${matchId}`);
            const data = await response.json();

            if (response.ok) {
                setMatch(data);
                setIsPaused(data.status === 'paused');
                setMatchState({
                    matchId: data.id,
                    matchStatus: data.status,
                    serverVersion: data.version,
                });
                if (data.match_scores?.[0]) {
                    updateScore(
                        data.match_scores[0].game_count_a,
                        data.match_scores[0].game_count_b,
                        '0',
                        '0'
                    );
                }
                setConnectionState('CONNECTED');

                // 大会情報を取得
                if (data.tournament_id) {
                    const tournamentRes = await fetch(`/api/tournaments/${data.tournament_id}`);
                    const tournamentData = await tournamentRes.json();
                    if (tournamentRes.ok) {
                        setTournament(tournamentData);
                        // 敗者審判モードでpending状態の場合、認証キー入力が必要
                        if (tournamentData.umpire_mode === 'LOSER' && data.status === 'pending' && !isVerified) {
                            setShowTokenModal(true);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch match:', error);
            setConnectionState('DISCONNECTED');
        } finally {
            setLoading(false);
        }
    }, [matchId, setMatchState, updateScore, setConnectionState, isVerified]);

    useEffect(() => {
        fetchMatch();
        return () => resetMatch();
    }, [fetchMatch, resetMatch]);

    // Supabase Realtime購読
    useEffect(() => {
        if (!matchId) return;

        const supabase = createClient();

        // スコア変更を購読
        const scoreChannel = supabase
            .channel(`match:${matchId}:score`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'match_scores',
                    filter: `match_id=eq.${matchId}`,
                },
                (payload) => {
                    // スコア更新を反映
                    if (payload.new) {
                        updateScore(
                            payload.new.game_count_a || 0,
                            payload.new.game_count_b || 0,
                            currentScoreA,
                            currentScoreB
                        );
                    }
                }
            )
            .subscribe();

        // 試合ステータス変更を購読
        const matchChannel = supabase
            .channel(`match:${matchId}:status`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'matches',
                    filter: `id=eq.${matchId}`,
                },
                (payload) => {
                    // 試合ステータス更新を反映
                    if (payload.new) {
                        setMatch((prev) => (prev ? { ...prev, ...payload.new } : null));
                        setMatchState({
                            matchId: payload.new.id,
                            matchStatus: payload.new.status,
                            serverVersion: payload.new.version || 1,
                        });
                        setIsPaused(payload.new.status === 'paused');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(scoreChannel);
            supabase.removeChannel(matchChannel);
        };
    }, [matchId, updateScore, setMatchState, currentScoreA, currentScoreB]);

    const handleAddPoint = async (pointType: 'A_score' | 'B_score') => {
        if (matchStatus !== 'inprogress' || isPaused) return;

        const clientUuid = uuidv4();

        // Add to local queue for offline support
        addPointToQueue({
            id: clientUuid,
            matchId,
            pointType,
            clientUuid,
            createdAt: new Date().toISOString(),
        });

        setSyncing(true);

        try {
            const response = await fetch('/api/scoring/points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    match_id: matchId,
                    point_type: pointType,
                    client_uuid: clientUuid,
                    matchVersion: match?.version,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                // レスポンスに最新スコアが含まれている場合、それを使用
                if (result.match_scores) {
                    updateScore(
                        result.match_scores.game_count_a || 0,
                        result.match_scores.game_count_b || 0,
                        currentScoreA,
                        currentScoreB
                    );
                    // Realtimeで更新されるため、fetchMatch()は不要
                } else {
                    // フォールバック: スコアが含まれていない場合は再取得
                    fetchMatch();
                }
            } else if (response.status === 409) {
                // Conflict - refetch latest state
                fetchMatch();
            }
        } catch (error) {
            console.error('Failed to add point:', error);
        } finally {
            setSyncing(false);
        }
    };

    const handleUndo = async () => {
        if (matchStatus !== 'inprogress') return;

        try {
            const response = await fetch('/api/scoring/undo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ match_id: matchId }),
            });

            if (response.ok) {
                fetchMatch();
            }
        } catch (error) {
            console.error('Failed to undo:', error);
        }
    };

    const handleVerifyToken = async () => {
        if (!tokenInput || tokenInput.length !== 4) {
            setTokenError('4桁の認証キーを入力してください');
            return;
        }

        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/verify-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day_token: tokenInput }),
            });

            const result = await response.json();
            if (!response.ok) {
                setTokenError(result.error || '認証キーが無効です');
                return;
            }

            setIsVerified(true);
            setShowTokenModal(false);
            setTokenError(null);
        } catch (error) {
            setTokenError('認証キーの検証に失敗しました');
        }
    };

    const handleStartMatch = async () => {
        // 敗者審判モードの場合、認証キー検証が必要
        if (tournament?.umpire_mode === 'LOSER' && !isVerified) {
            setShowTokenModal(true);
            return;
        }

        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/start`, {
                method: 'POST',
            });

            if (response.ok) {
                fetchMatch();
            }
        } catch (error) {
            console.error('Failed to start match:', error);
        }
    };

    const handlePauseMatch = async () => {
        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/pause`, {
                method: 'POST',
            });

            if (response.ok) {
                setIsPaused(true);
                await fetchMatch(); // 試合情報を再取得
            }
        } catch (error) {
            console.error('Failed to pause match:', error);
        }
    };

    const handleResumeMatch = async () => {
        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/resume`, {
                method: 'POST',
            });

            if (response.ok) {
                setIsPaused(false);
                await fetchMatch(); // 試合情報を再取得
            }
        } catch (error) {
            console.error('Failed to resume match:', error);
        }
    };

    const handleFinishMatch = async () => {
        if (!confirm('試合を終了しますか？')) return;

        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/finish`, {
                method: 'POST',
            });

            if (response.ok) {
                // 敗者審判モードの場合、審判権限の自動委譲処理
                if (tournament?.umpire_mode === 'LOSER' && match) {
                    // 敗者を判定（スコアから）
                    const scoreA = match.match_scores?.[0]?.game_count_a || 0;
                    const scoreB = match.match_scores?.[0]?.game_count_b || 0;
                    const loserEntry = scoreA < scoreB ? match.match_pairs?.[0] : match.match_pairs?.[1];

                    // 次試合の審判権限を有効化（実際の実装では、次試合のIDを取得して処理）
                    // ここでは通知のみ送信
                    if (loserEntry) {
                        addNotification({
                            type: 'umpire_assignment',
                            title: '審判担当通知',
                            message: '次試合の審判を担当してください',
                            data: {
                                match_id: matchId,
                                tournament_id: match.tournament_id,
                            },
                        });
                    }
                }

                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Failed to finish match:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            戻る
                        </button>
                        <div className="flex items-center gap-2">
                            {connectionState === 'CONNECTED' ? (
                                <Wifi className="w-5 h-5 text-green-400" />
                            ) : (
                                <WifiOff className="w-5 h-5 text-red-400" />
                            )}
                            {isSyncing && (
                                <span className="text-xs text-yellow-400">同期中...</span>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Match Info */}
            <div className="max-w-4xl mx-auto px-4 py-4">
                <div className="text-center mb-8">
                    <h1 className="text-xl font-semibold text-white">{match?.round_name}</h1>
                    <p className="text-slate-400">コート {match?.court_number || '-'}</p>
                </div>

                {/* Score Display */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 mb-8">
                    <div className="grid grid-cols-2 gap-8 text-center">
                        <div>
                            <p className="text-slate-400 mb-2">
                                {match?.match_pairs && match.match_pairs.length > 0 && match.match_pairs[0]?.teams
                                    ? match.match_pairs[0].teams.name
                                    : 'チームA'}
                            </p>
                            <div className="text-6xl font-bold text-white mb-4">{gameCountA}</div>
                            <div className="text-2xl text-blue-400">{currentScoreA}</div>
                        </div>
                        <div>
                            <p className="text-slate-400 mb-2">
                                {match?.match_pairs && match.match_pairs.length > 1 && match.match_pairs[1]?.teams
                                    ? match.match_pairs[1].teams.name
                                    : 'チームB'}
                            </p>
                            <div className="text-6xl font-bold text-white mb-4">{gameCountB}</div>
                            <div className="text-2xl text-cyan-400">{currentScoreB}</div>
                        </div>
                    </div>
                </div>

                {/* Token Verification Modal */}
                {showTokenModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
                            <h2 className="text-xl font-semibold text-white mb-4">認証キー入力</h2>
                            <p className="text-slate-400 text-sm mb-4">
                                通知センターから認証キーを確認してください
                            </p>
                            <input
                                type="text"
                                value={tokenInput}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                    setTokenInput(value);
                                    setTokenError(null);
                                }}
                                placeholder="4桁の認証キー"
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                                maxLength={4}
                                autoFocus
                            />
                            {tokenError && (
                                <p className="text-red-400 text-sm mb-4">{tokenError}</p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleVerifyToken}
                                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    確認
                                </button>
                                <button
                                    onClick={() => {
                                        setShowTokenModal(false);
                                        setTokenInput('');
                                        setTokenError(null);
                                    }}
                                    className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls */}
                {matchStatus === 'pending' && (
                    <button
                        onClick={handleStartMatch}
                        className="w-full py-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xl font-bold rounded-xl shadow-lg hover:from-green-600 hover:to-emerald-600 transition-all"
                    >
                        試合開始
                    </button>
                )}

                {matchStatus === 'inprogress' && (
                    <>
                        {/* Point Buttons - Large for mobile */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <button
                                onClick={() => handleAddPoint('A_score')}
                                disabled={isPaused}
                                className="py-16 bg-gradient-to-br from-blue-500 to-blue-600 text-white text-3xl font-bold rounded-xl shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                A +1
                            </button>
                            <button
                                onClick={() => handleAddPoint('B_score')}
                                disabled={isPaused}
                                className="py-16 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white text-3xl font-bold rounded-xl shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                B +1
                            </button>
                        </div>

                        {/* Secondary Controls */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <button
                                onClick={handleUndo}
                                disabled={isPaused}
                                className="flex items-center justify-center gap-2 py-4 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Undo2 className="w-5 h-5" />
                                取り消し
                            </button>
                            {isPaused ? (
                                <button
                                    onClick={handleResumeMatch}
                                    className="flex items-center justify-center gap-2 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                                >
                                    <Play className="w-5 h-5" />
                                    再開
                                </button>
                            ) : (
                                <button
                                    onClick={handlePauseMatch}
                                    className="flex items-center justify-center gap-2 py-4 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors"
                                >
                                    <Pause className="w-5 h-5" />
                                    中断
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleFinishMatch}
                            className="w-full py-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
                        >
                            試合終了
                        </button>
                    </>
                )}

                {matchStatus === 'finished' && (
                    <div className="text-center py-8">
                        <p className="text-2xl text-green-400 mb-4">試合終了</p>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-8 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
                        >
                            ダッシュボードへ戻る
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
