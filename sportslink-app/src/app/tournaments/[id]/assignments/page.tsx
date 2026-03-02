'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CollapsibleFilters from '@/components/ui/CollapsibleFilters';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Save, Filter } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Breadcrumbs from '@/components/Breadcrumbs';
import TournamentSubNav from '@/components/TournamentSubNav';
import { MatchStatusFilter, isValidMatchStatusFilter } from '@/types/match.types';

interface Match {
    id: string;
    round_name: string;
    match_number: number;
    status: 'pending' | 'inprogress' | 'finished';
    umpire_id: string | null;
    court_number: number | null;
    match_pairs?: Array<{
        teams?: {
            name: string;
        };
    }>;
    users?: {
        id: string;
        display_name: string;
        email: string;
    } | null;
}

interface Umpire {
    id: string;
    display_name: string;
    email: string;
}

interface Tournament {
    id: string;
    name: string;
}

export default function AssignmentsPage() {
    const params = useParams();
    const tournamentId = params.id as string;

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [umpires, setUmpires] = useState<Umpire[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>('all');
    const [roundFilter, setRoundFilter] = useState<string>('all');
    const [assignments, setAssignments] = useState<Record<string, { umpire_id?: string; court_number?: number }>>({});
    const [isSaving, setIsSaving] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            const tournamentRes = await fetch(`/api/tournaments/${tournamentId}`);
            const tournamentData = await tournamentRes.json();
            if (tournamentRes.ok) {
                setTournament(tournamentData);
            }

            const matchesRes = await fetch(`/api/tournaments/${tournamentId}/matches`);
            const matchesData = await matchesRes.json();
            if (matchesRes.ok) {
                setMatches(matchesData.data || []);
            }

            const umpiresRes = await fetch('/api/auth/umpires');
            const umpiresData = await umpiresRes.json();
            if (umpiresRes.ok) {
                setUmpires(umpiresData.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAssignmentChange = (
        matchId: string,
        field: 'umpire_id' | 'court_number',
        value: string | number | undefined
    ) => {
        setAssignments((prev) => ({
            ...prev,
            [matchId]: {
                ...prev[matchId],
                [field]: value,
            },
        }));
    };

    const handleSave = async () => {
        try {
            const invalidCourt = Object.values(assignments).some(
                (data) => data.court_number !== undefined && (data.court_number < 1 || !Number.isInteger(data.court_number))
            );
            if (invalidCourt) {
                toast.error('コート番号は1以上の正の整数のみ指定できます。');
                return;
            }
            const updates = Object.entries(assignments).map(([matchId, data]) => {
                const court = data.court_number;
                const courtNumber = court !== undefined && Number.isInteger(court) && court >= 1 ? court : data.court_number;
                return { id: matchId, ...data, court_number: courtNumber };
            });
            setIsSaving(true);

            const response = await fetch(`/api/tournaments/${tournamentId}/draw`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matches: updates }),
            });

            const result = await response.json();
            if (!response.ok) {
                toast.error(result.error || '保存に失敗しました');
                return;
            }

            toast.success('保存しました');
            fetchData();
            setAssignments({});
        } catch {
            toast.error('保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUmpireChange = async (matchId: string, umpireId: string | null) => {
        try {
            if (umpireId) {
                const response = await fetch(`/api/matches/${matchId}/umpire`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ umpire_id: umpireId }),
                });

                if (!response.ok) {
                    const result = await response.json();
                    toast.error(result.error || '審判の変更に失敗しました');
                    return;
                }
            } else {
                const response = await fetch(`/api/matches/${matchId}/umpire`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const result = await response.json();
                    toast.error(result.error || '審判の解除に失敗しました');
                    return;
                }
            }

            fetchData();
        } catch {
            toast.error('審判の変更に失敗しました');
        }
    };

    const filteredMatches = matches.filter((match) => {
        if (statusFilter !== 'all' && match.status !== statusFilter) {
            return false;
        }
        if (roundFilter !== 'all' && match.round_name !== roundFilter) {
            return false;
        }
        return true;
    });

    const uniqueRounds = Array.from(new Set(matches.map((m) => m.round_name)));

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
                            { label: '試合割当' },
                        ]}
                    />
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                                試合割当
                            </h1>
                            {tournament && <p className="text-slate-400 mt-2">{tournament.name}</p>}
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || Object.keys(assignments).length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? '保存中...' : '保存'}
                        </button>
                    </div>
                </div>

                <TournamentSubNav tournamentId={tournamentId} />

                <CollapsibleFilters>
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (isValidMatchStatusFilter(value)) {
                                    setStatusFilter(value);
                                }
                            }}
                            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="all">すべてのステータス</option>
                            <option value="pending">待機中</option>
                            <option value="inprogress">進行中</option>
                            <option value="paused">一時停止</option>
                            <option value="finished">終了</option>
                        </select>
                    </div>
                    <select
                        value={roundFilter}
                        onChange={(e) => setRoundFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        <option value="all">すべてのラウンド</option>
                        {uniqueRounds.map((round) => (
                            <option key={round} value={round}>
                                {round}
                            </option>
                        ))}
                    </select>
                </div>
                </CollapsibleFilters>

                {/* Matches List */}
                <div className="space-y-4">
                    {filteredMatches.map((match) => {
                        const currentAssignment = assignments[match.id] || {};
                        const currentUmpire = match.umpire_id || currentAssignment.umpire_id;
                        const currentCourt = match.court_number || currentAssignment.court_number;

                        return (
                            <div
                                key={match.id}
                                className="p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                    <div>
                                        <p className="text-white font-medium">{match.round_name}</p>
                                        <p className="text-slate-400 text-sm">試合 #{match.match_number}</p>
                                        {match.match_pairs && match.match_pairs.length > 0 && (
                                            <p className="text-slate-300 text-sm mt-1">
                                                {match.match_pairs.map((p) => p.teams?.name).join(' vs ')}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-300 mb-2">審判</label>
                                        <select
                                            value={currentUmpire || ''}
                                            onChange={(e) => {
                                                const value = e.target.value || null;
                                                handleUmpireChange(match.id, value);
                                            }}
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                        >
                                            <option value="">未割当</option>
                                            {umpires.map((umpire) => (
                                                <option key={umpire.id} value={umpire.id}>
                                                    {umpire.display_name || umpire.email}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-300 mb-2">コート番号</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={currentCourt ?? ''}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                if (raw === '') {
                                                    handleAssignmentChange(match.id, 'court_number', undefined);
                                                    return;
                                                }
                                                const value = parseInt(raw, 10);
                                                if (!Number.isNaN(value) && value >= 1) {
                                                    handleAssignmentChange(match.id, 'court_number', value);
                                                }
                                            }}
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                            placeholder="コート番号（正の整数）"
                                        />
                                    </div>
                                    <div>
                                        <span
                                            className={`inline-block px-3 py-1 text-xs rounded ${match.status === 'finished'
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
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredMatches.length > 0 && (
                    <div className="mt-6 flex justify-center md:justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || Object.keys(assignments).length === 0}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? '保存中...' : '割り当てを保存'}
                        </button>
                    </div>
                )}

                {filteredMatches.length === 0 && (
                    <div className="text-center py-12">
                        {matches.length === 0 ? (
                            <>
                                <p className="text-slate-400 text-lg mb-4">ドローが生成されていません</p>
                                <p className="text-slate-500 text-sm mb-6">
                                    試合割当を行うには、先にドロー管理でドローを生成してください
                                </p>
                                <Link
                                    href={`/tournaments/${tournamentId}/draw`}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors"
                                >
                                    ドロー管理へ
                                </Link>
                            </>
                        ) : (
                            <p className="text-slate-400">条件に一致する試合がありません</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

