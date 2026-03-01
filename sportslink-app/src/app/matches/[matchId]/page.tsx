'use client';

import { Suspense, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Edit, Users, Plus, Save, X } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';

interface Match {
    id: string;
    round_name: string;
    match_number: number;
    status: 'pending' | 'inprogress' | 'finished';
    umpire_id: string | null;
    court_number: number | null;
    started_at: string | null;
    created_at: string;
    match_scores?: Array<{
        game_count_a: number;
        game_count_b: number;
        final_score: string | null;
    }>;
    match_pairs?: Array<{
        id: string;
        pair_number: number;
        team_id: string;
        teams?: {
            id: string;
            name: string;
            team_manager_user_id?: string | null;
        };
        tournament_players?: Array<{
            id: string;
            player_name: string;
            player_type: string;
        }>;
    }>;
    tournaments?: {
        id: string;
        name: string;
        match_format?: string;
    };
}

interface Player {
    id: string;
    player_name: string;
    player_type: string;
    team_id?: string;
}

interface PairForm {
    pair_number: number;
    player_1_id: string;
    player_2_id?: string;
}

export default function MatchDetailPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                    <LoadingSpinner />
                </div>
            }
        >
            <MatchDetailContent />
        </Suspense>
    );
}

function MatchDetailContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const matchId = params.matchId as string;
    const tournamentIdFromQuery = searchParams.get('tournamentId');
    const { user } = useAuthStore();

    const [match, setMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tournamentPlayers, setTournamentPlayers] = useState<Player[]>([]);
    const [showPairForm, setShowPairForm] = useState(false);
    const [editingPair, setEditingPair] = useState<number | null>(null);
    const [pairForms, setPairForms] = useState<Record<number, PairForm>>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchMatch();
    }, [matchId]);

    const fetchMatch = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/matches/${matchId}`);
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '試合の取得に失敗しました');
                return;
            }

            setMatch(result);

            // 大会の選手一覧を取得（ペア提出用）
            if (result.tournament_id || result.tournaments?.id) {
                const tournamentId = result.tournament_id || result.tournaments?.id;
                const playersRes = await fetch(`/api/tournaments/${tournamentId}/players`);
                const playersData = await playersRes.json();
                if (playersRes.ok) {
                    setTournamentPlayers(playersData.data || []);
                }
            }
        } catch (err) {
            console.error('Failed to fetch match:', err);
            setError('試合の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    // 自分のチームかどうかを判定
    const isMyTeam = (teamId: string) => {
        if (!user || !match) return false;
        const team = match.match_pairs?.find((p) => p.team_id === teamId)?.teams;
        return team?.team_manager_user_id === user.id;
    };

    // 必要なペア数を取得（試合形式から判定、デフォルトは2）
    const getRequiredPairCount = () => {
        const format = match?.tournaments?.match_format;
        if (format === 'team_doubles_3') return 3;
        if (format === 'team_doubles_4_singles_1') return 5;
        return 2; // デフォルト
    };

    const handleAddPair = (teamId: string, pairNumber: number) => {
        setPairForms((prev) => ({
            ...prev,
            [pairNumber]: {
                pair_number: pairNumber,
                player_1_id: '',
                player_2_id: '',
            },
        }));
        setEditingPair(pairNumber);
        setShowPairForm(true);
    };

    const handleEditPair = (pair: NonNullable<Match['match_pairs']>[number]) => {
        setPairForms((prev) => ({
            ...prev,
            [pair.pair_number]: {
                pair_number: pair.pair_number,
                player_1_id: pair.tournament_players?.[0]?.id || '',
                player_2_id: pair.tournament_players?.[1]?.id || '',
            },
        }));
        setEditingPair(pair.pair_number);
        setShowPairForm(true);
    };

    const handleSubmitPairs = async (teamId: string) => {
        if (!match) return;

        const requiredCount = getRequiredPairCount();
        const myTeamPairs = match.match_pairs?.filter((p) => p.team_id === teamId) || [];
        const submittedPairs = Object.values(pairForms).filter(
            (form) => form.player_1_id && form.pair_number
        );

        if (submittedPairs.length < requiredCount) {
            toast.error(`必要なペア数（${requiredCount}組）に達していません`);
            return;
        }

        try {
            setSubmitting(true);
            const pairs = submittedPairs.map((form) => ({
                pair_number: form.pair_number,
                team_id: teamId,
                player_1_id: form.player_1_id,
                player_2_id: form.player_2_id || null,
            }));

            const response = await fetch(`/api/matches/${matchId}/pairs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pairs }),
            });

            if (!response.ok) {
                const result = await response.json();
                toast.error(result.error || 'ペアの提出に失敗しました');
                return;
            }

            toast.success('ペアを提出しました');
            setShowPairForm(false);
            setEditingPair(null);
            setPairForms({});
            fetchMatch();
        } catch (err) {
            toast.error('ペアの提出に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    if (error || !match) {
        const backHref = tournamentIdFromQuery ? `/tournaments/${tournamentIdFromQuery}/draw` : '/dashboard';
        const backLabel = tournamentIdFromQuery ? 'ドローに戻る' : 'ダッシュボードに戻る';
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                        <p className="text-red-400 text-center mb-4">{error || '試合が見つかりません'}</p>
                        <Link
                            href={backHref}
                            className="block text-center text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            {backLabel}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 mb-8">
                    <div className="flex items-center justify-between py-4">
                        <Breadcrumbs
                            items={(() => {
                                const tid = tournamentIdFromQuery || match?.tournaments?.id;
                                const tname = match?.tournaments?.name;
                                const items: Array<{ label: string; href?: string }> = [];
                                if (tid && tname) {
                                    items.push({ label: tname, href: `/tournaments/${tid}` });
                                } else if (tournamentIdFromQuery) {
                                    items.push({ label: '大会ドロー', href: `/tournaments/${tournamentIdFromQuery}/draw` });
                                } else {
                                    items.push({ label: '担当試合一覧', href: '/assigned-matches' });
                                }
                                items.push({ label: match?.round_name || '試合詳細' });
                                return items;
                            })()}
                        />
                        <div className="flex items-center gap-4">
                            <NotificationCenter />
                        </div>
                    </div>
                </header>

                {/* Match Info */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8 mb-8">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
                            {match.tournaments?.name || '大会'} - {match.round_name}
                        </h1>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-slate-400">試合番号</p>
                                <p className="text-white">#{match.match_number}</p>
                            </div>
                            {match.court_number && (
                                <div>
                                    <p className="text-slate-400">コート番号</p>
                                    <p className="text-white">{match.court_number}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-slate-400">ステータス</p>
                                <span
                                    className={`inline-block px-3 py-1 text-xs rounded ${
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
                            {match.started_at && (
                                <div>
                                    <p className="text-slate-400">開始時刻</p>
                                    <p className="text-white">
                                        {new Date(match.started_at).toLocaleTimeString('ja-JP')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Score Display */}
                    {match.match_scores && match.match_scores.length > 0 && (
                        <div className="mb-6 p-6 bg-slate-700/50 rounded-xl">
                            <div className="flex items-center justify-center gap-8">
                                <div className="text-center">
                                    <p className="text-slate-400 text-sm mb-2">
                                        {match.match_pairs?.[0]?.teams?.name || 'チームA'}
                                    </p>
                                    <p className="text-5xl font-bold text-blue-400">
                                        {match.match_scores[0].game_count_a}
                                    </p>
                                </div>
                                <span className="text-slate-400 text-2xl">-</span>
                                <div className="text-center">
                                    <p className="text-slate-400 text-sm mb-2">
                                        {match.match_pairs?.[1]?.teams?.name || 'チームB'}
                                    </p>
                                    <p className="text-5xl font-bold text-blue-400">
                                        {match.match_scores[0].game_count_b}
                                    </p>
                                </div>
                            </div>
                            {match.match_scores[0].final_score && (
                                <p className="text-center text-slate-300 mt-4">
                                    最終スコア: {match.match_scores[0].final_score}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Pairs Info */}
                    {match.match_pairs && match.match_pairs.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-white">ペア情報</h2>
                            </div>
                            {match.match_pairs.map((pair, idx) => {
                                const isMyTeamPair = isMyTeam(pair.team_id);
                                const canEdit = match.status === 'pending' && isMyTeamPair;

                                return (
                                    <div
                                        key={pair.id}
                                        className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <p className="text-white font-medium">
                                                    {pair.teams?.name || `チーム${idx + 1}`}
                                                </p>
                                                {isMyTeamPair && (
                                                    <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
                                                        自分のチーム
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 text-sm">ペア #{pair.pair_number}</span>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleEditPair(pair)}
                                                        className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                                        title="ペアを編集"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {pair.tournament_players && pair.tournament_players.length > 0 ? (
                                            <div className="space-y-1">
                                                {pair.tournament_players.map((player) => (
                                                    <p key={player.id} className="text-slate-300 text-sm">
                                                        {player.player_name} ({player.player_type})
                                                    </p>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-slate-400 text-sm">ペア未提出</p>
                                        )}
                                    </div>
                                );
                            })}

                            {/* ペア提出フォーム（自分のチームのみ、pending時のみ） */}
                            {match.status === 'pending' &&
                                match.match_pairs?.some((p) => isMyTeam(p.team_id)) && (
                                    <div className="mt-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-white">ペア提出</h3>
                                            {!showPairForm && (
                                                <button
                                                    onClick={() => {
                                                        const myTeam = match.match_pairs?.find((p) =>
                                                            isMyTeam(p.team_id)
                                                        );
                                                        if (myTeam) {
                                                            const requiredCount = getRequiredPairCount();
                                                            const existingPairs =
                                                                match.match_pairs?.filter(
                                                                    (p) => p.team_id === myTeam.team_id
                                                                ) || [];
                                                            const nextPairNumber =
                                                                existingPairs.length > 0
                                                                    ? Math.max(
                                                                          ...existingPairs.map((p) => p.pair_number)
                                                                      ) + 1
                                                                    : 1;
                                                            if (nextPairNumber <= requiredCount) {
                                                                handleAddPair(myTeam.team_id, nextPairNumber);
                                                            } else {
                                                                toast.info(`必要なペア数（${requiredCount}組）に達しています`);
                                                            }
                                                        }
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    ペアを追加
                                                </button>
                                            )}
                                        </div>

                                        {showPairForm && editingPair !== null && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm text-slate-300 mb-2">
                                                            選手1
                                                        </label>
                                                        <select
                                                            value={pairForms[editingPair]?.player_1_id || ''}
                                                            onChange={(e) => {
                                                                setPairForms((prev) => ({
                                                                    ...prev,
                                                                    [editingPair]: {
                                                                        ...prev[editingPair],
                                                                        pair_number: editingPair,
                                                                        player_1_id: e.target.value,
                                                                    },
                                                                }));
                                                            }}
                                                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="">選択してください</option>
                                                            {tournamentPlayers
                                                                .filter((p) => {
                                                                    const myTeam = match.match_pairs?.find((pair) =>
                                                                        isMyTeam(pair.team_id)
                                                                    );
                                                                    return p.team_id === myTeam?.team_id;
                                                                })
                                                                .map((player) => (
                                                                    <option key={player.id} value={player.id}>
                                                                        {player.player_name} ({player.player_type})
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm text-slate-300 mb-2">
                                                            選手2（ダブルスの場合）
                                                        </label>
                                                        <select
                                                            value={pairForms[editingPair]?.player_2_id || ''}
                                                            onChange={(e) => {
                                                                setPairForms((prev) => ({
                                                                    ...prev,
                                                                    [editingPair]: {
                                                                        ...prev[editingPair],
                                                                        pair_number: editingPair,
                                                                        player_2_id: e.target.value || undefined,
                                                                    },
                                                                }));
                                                            }}
                                                            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="">シングルスの場合は空欄</option>
                                                            {tournamentPlayers
                                                                .filter((p) => {
                                                                    const myTeam = match.match_pairs?.find((pair) =>
                                                                        isMyTeam(pair.team_id)
                                                                    );
                                                                    return (
                                                                        p.team_id === myTeam?.team_id &&
                                                                        p.id !== pairForms[editingPair]?.player_1_id
                                                                    );
                                                                })
                                                                .map((player) => (
                                                                    <option key={player.id} value={player.id}>
                                                                        {player.player_name} ({player.player_type})
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const myTeam = match.match_pairs?.find((p) =>
                                                                isMyTeam(p.team_id)
                                                            );
                                                            if (myTeam) {
                                                                handleSubmitPairs(myTeam.team_id);
                                                            }
                                                        }}
                                                        disabled={
                                                            submitting ||
                                                            !pairForms[editingPair]?.player_1_id ||
                                                            Object.keys(pairForms).length < getRequiredPairCount()
                                                        }
                                                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        {submitting ? '提出中...' : 'ペアを提出'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowPairForm(false);
                                                            setEditingPair(null);
                                                            setPairForms({});
                                                        }}
                                                        className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        キャンセル
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4 mt-8">
                        {match.status === 'pending' && (
                            <Link
                                href={`/scoring/${match.id}`}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                            >
                                <Play className="w-5 h-5" />
                                試合開始・スコア入力
                            </Link>
                        )}
                        {match.status === 'inprogress' && (
                            <Link
                                href={`/scoring/${match.id}`}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-200"
                            >
                                <Edit className="w-5 h-5" />
                                スコア入力
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

