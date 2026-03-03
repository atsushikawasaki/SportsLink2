'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { confirmAsync } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useParams, useRouter } from 'next/navigation';
import { useMatchStore } from '@/features/scoring/hooks/useMatchStore';
import { useNotificationStore } from '@/features/notifications/hooks/useNotificationStore';
import { ArrowLeft, Undo2, Wifi, WifiOff, Pause, Play, AlertTriangle, Clock, UserCheck, Stethoscope } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ConflictResolutionModal from '@/features/scoring/components/ConflictResolutionModal';
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

interface PointLog {
    id: string;
    point_type: 'A_score' | 'B_score';
    created_at: string;
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

    const { addNotification } = useNotificationStore();
    const supabase = useMemo(() => createClient(), []);
    const currentScoreARef = useRef(currentScoreA);
    const currentScoreBRef = useRef(currentScoreB);
    currentScoreARef.current = currentScoreA;
    currentScoreBRef.current = currentScoreB;
    const [match, setMatch] = useState<Match | null>(null);
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [tokenError, setTokenError] = useState<string | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [nextMatchId, setNextMatchId] = useState<string | null>(null);
    const [isVerified, setIsVerified] = useState(false);
    const [matchLog, setMatchLog] = useState<PointLog[]>([]);
    const logEndRef = useRef<HTMLDivElement>(null);

    const fetchPoints = useCallback(async () => {
        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/points`);
            if (response.ok) {
                const data = await response.json();
                setMatchLog(data.data || []);
            }
        } catch {
            // ignore - log is non-critical
        }
    }, [matchId]);

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

                if (data.tournament_id) {
                    const tournamentRes = await fetch(`/api/tournaments/${data.tournament_id}`);
                    const tournamentData = await tournamentRes.json();
                    if (tournamentRes.ok) {
                        setTournament(tournamentData);
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
        fetchPoints();
        return () => resetMatch();
    }, [fetchMatch, fetchPoints, resetMatch]);

    // Auto-scroll log to bottom
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [matchLog]);

    // Supabase Realtime subscriptions
    useEffect(() => {
        if (!matchId) return;

        const scoreChannel = supabase
            .channel(`match:${matchId}:score`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'match_scores', filter: `match_id=eq.${matchId}` },
                (payload) => {
                    if (payload.new) {
                        updateScore(
                            payload.new.game_count_a || 0,
                            payload.new.game_count_b || 0,
                            currentScoreARef.current,
                            currentScoreBRef.current
                        );
                    }
                }
            )
            .subscribe();

        const matchChannel = supabase
            .channel(`match:${matchId}:status`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
                (payload) => {
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

        const pointsChannel = supabase
            .channel(`match:${matchId}:points`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'points', filter: `match_id=eq.${matchId}` },
                (payload) => {
                    if (payload.new) {
                        setMatchLog((prev) => [...prev, payload.new as PointLog]);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'points', filter: `match_id=eq.${matchId}` },
                () => { fetchPoints(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(scoreChannel);
            supabase.removeChannel(matchChannel);
            supabase.removeChannel(pointsChannel);
        };
    }, [matchId, supabase, updateScore, setMatchState, fetchPoints]);

    const handleAddPoint = async (pointType: 'A_score' | 'B_score') => {
        if (matchStatus !== 'inprogress' || isPaused) return;

        const clientUuid = uuidv4();

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
                if (result.match_scores) {
                    updateScore(
                        result.match_scores.game_count_a || 0,
                        result.match_scores.game_count_b || 0,
                        currentScoreARef.current,
                        currentScoreBRef.current
                    );
                } else {
                    fetchMatch();
                }
            } else if (response.status === 409) {
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
                fetchPoints();
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
        } catch {
            setTokenError('認証キーの検証に失敗しました');
        }
    };

    const handleStartMatch = async () => {
        if (tournament?.umpire_mode === 'LOSER' && !isVerified) {
            setShowTokenModal(true);
            return;
        }

        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/start`, { method: 'POST' });
            if (response.ok) { fetchMatch(); }
        } catch (error) {
            console.error('Failed to start match:', error);
        }
    };

    const handlePauseMatch = async () => {
        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/pause`, { method: 'POST' });
            if (response.ok) {
                setIsPaused(true);
                await fetchMatch();
            }
        } catch (error) {
            console.error('Failed to pause match:', error);
        }
    };

    const handleResumeMatch = async () => {
        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/resume`, { method: 'POST' });
            if (response.ok) {
                setIsPaused(false);
                await fetchMatch();
            }
        } catch (error) {
            console.error('Failed to resume match:', error);
        }
    };

    const handleFinishMatch = async () => {
        const ok = await confirmAsync({ title: '確認', message: '試合を終了しますか？', confirmLabel: '終了' });
        if (!ok) return;

        try {
            const response = await fetch(`/api/scoring/matches/${matchId}/finish`, { method: 'POST' });

            if (response.ok) {
                if (tournament?.umpire_mode === 'LOSER' && match) {
                    const scoreA = match.match_scores?.[0]?.game_count_a || 0;
                    const scoreB = match.match_scores?.[0]?.game_count_b || 0;
                    const loserEntry = match.match_pairs && match.match_pairs.length >= 2
                        ? (scoreA < scoreB ? match.match_pairs[0] : match.match_pairs[1])
                        : null;

                    if (loserEntry) {
                        addNotification({
                            type: 'umpire_assignment',
                            title: '審判担当通知',
                            message: '次試合の審判を担当してください',
                            data: { match_id: matchId, tournament_id: match.tournament_id },
                        });
                    }
                }

                try {
                    const nextRes = await fetch('/api/scoring/live');
                    if (nextRes.ok) {
                        const nextData = await nextRes.json();
                        const nextMatch = (nextData.data || []).find(
                            (m: { id: string; status: string }) => m.id !== matchId && (m.status === 'pending' || m.status === 'inprogress')
                        );
                        if (nextMatch) {
                            setNextMatchId(nextMatch.id);
                            return;
                        }
                    }
                } catch {
                    // ignore
                }
                router.push('/assigned-matches');
            }
        } catch (error) {
            console.error('Failed to finish match:', error);
        }
    };

    const teamAName = match?.match_pairs?.[0]?.teams?.name || 'チームA';
    const teamBName = match?.match_pairs && match.match_pairs.length >= 2 ? (match.match_pairs[1]?.teams?.name || 'チームB') : 'チームB';

    const formatLogEntry = (entry: PointLog) => {
        const time = new Date(entry.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const label = entry.point_type === 'A_score' ? `${teamAName} 得点` : `${teamBName} 得点`;
        return { time, label };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)]">
            <ConflictResolutionModal onUseServerScore={fetchMatch} />

            {/* Header */}
            <header className="bg-[var(--color-bg-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border-base)] sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
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

            <div className="max-w-6xl mx-auto px-4 py-4 lg:flex lg:gap-6">
                {/* Main scoring area */}
                <div className="flex-1">
                    {connectionState !== 'CONNECTED' && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center gap-3">
                            <WifiOff className="w-5 h-5 text-red-400 shrink-0" />
                            <p className="text-red-400 text-sm font-medium">接続が切断されています。データはローカルに保存され、再接続時に同期されます。</p>
                        </div>
                    )}

                    <div className="text-center mb-6">
                        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{match?.round_name}</h1>
                        <p className="text-[var(--color-text-muted)]">コート {match?.court_number || '-'}</p>
                    </div>

                    {/* Score Display */}
                    <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-base)] p-6 mb-6">
                        <div className="grid grid-cols-2 gap-8 text-center">
                            <div>
                                <p className="text-[var(--color-text-muted)] mb-2 truncate">{teamAName}</p>
                                <div className="text-6xl font-bold text-[var(--color-text-primary)] mb-3">{gameCountA}</div>
                                <div className="text-2xl text-brand">{currentScoreA}</div>
                            </div>
                            <div>
                                <p className="text-[var(--color-text-muted)] mb-2 truncate">{teamBName}</p>
                                <div className="text-6xl font-bold text-[var(--color-text-primary)] mb-3">{gameCountB}</div>
                                <div className="text-2xl text-cyan-400">{currentScoreB}</div>
                            </div>
                        </div>
                    </div>

                    {/* Token Verification Modal */}
                    <Modal
                        isOpen={showTokenModal}
                        onClose={() => { setShowTokenModal(false); setTokenInput(''); setTokenError(null); }}
                        title="認証キー入力"
                    >
                        <p className="text-[var(--color-text-muted)] text-sm mb-4">
                            敗者審判モードでは、試合開始時に当日の認証キーが必要です。通知センターまたはエントリー一覧で確認した4桁のキーを入力してください。
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
                            className="w-full px-4 py-3 bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-brand mb-4"
                            maxLength={4}
                            autoFocus
                        />
                        {tokenError && (
                            <p className="text-red-400 text-sm mb-4">{tokenError}</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleVerifyToken}
                                className="flex-1 px-4 py-3 min-h-[48px] bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors font-semibold"
                            >
                                確認
                            </button>
                            <button
                                onClick={() => { setShowTokenModal(false); setTokenInput(''); setTokenError(null); }}
                                className="px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-border-base)] transition-colors"
                            >
                                キャンセル
                            </button>
                        </div>
                    </Modal>

                    {/* Controls */}
                    {matchStatus === 'pending' && (
                        <button
                            onClick={handleStartMatch}
                            className="w-full py-6 bg-green-500 text-white text-xl font-bold rounded-xl hover:bg-green-600 transition-colors"
                        >
                            試合開始
                        </button>
                    )}

                    {matchStatus === 'inprogress' && (
                        <>
                            {isPaused && (
                                <div className="mb-4 p-4 bg-yellow-500/20 border border-yellow-500/40 rounded-xl flex items-center gap-3">
                                    <AlertTriangle className="w-6 h-6 text-yellow-400 shrink-0" />
                                    <div>
                                        <p className="text-yellow-400 font-semibold">試合一時停止中</p>
                                        <p className="text-yellow-400/70 text-sm">再開ボタンを押すとスコア入力を続けられます</p>
                                    </div>
                                </div>
                            )}

                            {/* Point Buttons */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <button
                                    onClick={() => handleAddPoint('A_score')}
                                    disabled={isPaused}
                                    className="py-16 bg-brand text-white rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-hover"
                                >
                                    <span className="block text-sm font-medium mb-1 opacity-80 truncate px-2">{teamAName}</span>
                                    <span className="block text-3xl font-bold">+1</span>
                                </button>
                                <button
                                    onClick={() => handleAddPoint('B_score')}
                                    disabled={isPaused}
                                    className="py-16 bg-cyan-500 text-white rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-600"
                                >
                                    <span className="block text-sm font-medium mb-1 opacity-80 truncate px-2">{teamBName}</span>
                                    <span className="block text-3xl font-bold">+1</span>
                                </button>
                            </div>

                            {/* Action Buttons (UI only) */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <button
                                    className="flex flex-col items-center justify-center gap-1 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] text-[var(--color-text-muted)] rounded-xl hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)] transition-colors text-xs"
                                >
                                    <Clock className="w-4 h-4" />
                                    タイムアウト
                                </button>
                                <button
                                    className="flex flex-col items-center justify-center gap-1 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] text-[var(--color-text-muted)] rounded-xl hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)] transition-colors text-xs"
                                >
                                    <UserCheck className="w-4 h-4" />
                                    選手交代
                                </button>
                                <button
                                    className="flex flex-col items-center justify-center gap-1 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] text-[var(--color-text-muted)] rounded-xl hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)] transition-colors text-xs"
                                >
                                    <Stethoscope className="w-4 h-4" />
                                    メディカル
                                </button>
                            </div>

                            {/* Secondary Controls - hidden on mobile (undo is in footer) */}
                            <div className="hidden lg:grid grid-cols-2 gap-4 mb-4">
                                <button
                                    onClick={handleUndo}
                                    disabled={isPaused}
                                    className="flex items-center justify-center gap-2 py-4 bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-xl hover:bg-[var(--color-border-base)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

                            {/* Mobile pause/resume button */}
                            <div className="lg:hidden mb-4">
                                {isPaused ? (
                                    <button
                                        onClick={handleResumeMatch}
                                        className="w-full flex items-center justify-center gap-2 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                                    >
                                        <Play className="w-5 h-5" />
                                        再開
                                    </button>
                                ) : (
                                    <button
                                        onClick={handlePauseMatch}
                                        className="w-full flex items-center justify-center gap-2 py-4 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors"
                                    >
                                        <Pause className="w-5 h-5" />
                                        中断
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={handleFinishMatch}
                                className="w-full py-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors mb-16 lg:mb-0"
                            >
                                試合終了
                            </button>
                        </>
                    )}

                    {matchStatus === 'finished' && (
                        <div className="text-center py-8 space-y-4">
                            <p className="text-2xl text-green-400 mb-4">試合終了</p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                {nextMatchId && (
                                    <button
                                        onClick={() => router.push(`/scoring/${nextMatchId}`)}
                                        className="px-6 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand-hover transition-colors"
                                    >
                                        次の担当試合へ
                                    </button>
                                )}
                                <button
                                    onClick={() => router.push('/assigned-matches')}
                                    className="px-6 py-3 bg-brand text-white rounded-xl hover:bg-brand-hover transition-colors"
                                >
                                    担当試合一覧へ
                                </button>
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="px-6 py-3 bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-xl hover:bg-[var(--color-border-base)] transition-colors"
                                >
                                    ダッシュボードへ戻る
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Desktop Match Log Sidebar */}
                <div className="hidden lg:flex lg:flex-col w-72 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-base)] p-4 self-start sticky top-20 max-h-[calc(100vh-6rem)] overflow-hidden">
                    <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">試合ログ</h2>
                    <div className="flex-1 overflow-y-auto space-y-1.5">
                        {matchLog.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">ログはありません</p>
                        ) : (
                            matchLog.map((entry, i) => {
                                const { time, label } = formatLogEntry(entry);
                                return (
                                    <div
                                        key={entry.id}
                                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                                            entry.point_type === 'A_score'
                                                ? 'bg-brand/10 text-brand'
                                                : 'bg-cyan-500/10 text-cyan-400'
                                        }`}
                                    >
                                        <span className="font-medium">{i + 1}. {label}</span>
                                        <span className="text-xs opacity-60">{time}</span>
                                    </div>
                                );
                            })
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>

            {/* Mobile Log (collapsed at bottom, scroll) */}
            {matchLog.length > 0 && (
                <div className="lg:hidden mx-4 mt-4 mb-20 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] p-3">
                    <h2 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">試合ログ（直近5件）</h2>
                    <div className="space-y-1">
                        {matchLog.slice(-5).map((entry, i, arr) => {
                            const { time, label } = formatLogEntry(entry);
                            return (
                                <div
                                    key={entry.id}
                                    className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                                        entry.point_type === 'A_score'
                                            ? 'bg-brand/10 text-brand'
                                            : 'bg-cyan-500/10 text-cyan-400'
                                    }`}
                                >
                                    <span>{matchLog.length - arr.length + i + 1}. {label}</span>
                                    <span className="opacity-60">{time}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Mobile Fixed Footer - Undo button */}
            {matchStatus === 'inprogress' && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-base)] px-4 py-3">
                    <button
                        onClick={handleUndo}
                        disabled={isPaused}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-xl hover:bg-[var(--color-border-base)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Undo2 className="w-5 h-5" />
                        1手戻す
                    </button>
                </div>
            )}
        </div>
    );
}
