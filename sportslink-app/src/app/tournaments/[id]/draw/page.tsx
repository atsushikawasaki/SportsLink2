'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { toast, confirmAsync } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, List, Grid, Edit, Save, X } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Breadcrumbs from '@/components/Breadcrumbs';
import TournamentSubNav from '@/components/TournamentSubNav';
import { getCsrfHeaders } from '@/lib/csrf';

interface MatchSlot {
    id: string;
    slot_number: number;
    source_type: 'entry' | 'winner' | 'loser' | 'bye';
    entry_id: string | null;
    source_match_id: string | null;
    placeholder_label: string | null;
    tournament_entries?: {
        id: string;
        entry_type?: string;
        region_name?: string | null;
        custom_display_name?: string | null;
        team_id?: string | null;
        teams?: { id: string; name: string } | null;
    } | null;
}

interface TournamentEntry {
    id: string;
    entry_type: string;
    region_name?: string | null;
    custom_display_name?: string | null;
    teams?: {
        id: string;
        name: string;
    };
}

interface Match {
    id: string;
    round_name: string;
    round_index: number;
    slot_index: number;
    match_number: number;
    status: 'pending' | 'inprogress' | 'finished';
    umpire_id: string | null;
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
    match_slots?: MatchSlot[];
}

interface Phase {
    id: string;
    name: string;
    phase_type: string;
    sequence: number;
}

export default function DrawPage() {
    const params = useParams();
    const router = useRouter();
    const tournamentId = params.id as string;

    const [tournament, setTournament] = useState<any>(null);
    const [phases, setPhases] = useState<Phase[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'bracket'>('list');
    const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingMatch, setEditingMatch] = useState<string | null>(null);
    const [entries, setEntries] = useState<TournamentEntry[]>([]);
    const [editingSlots, setEditingSlots] = useState<Record<string, Partial<MatchSlot>>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [umpireInitial, setUmpireInitial] = useState<'guest' | 'unassigned' | 'me'>('me');
    const [canRegenerate, setCanRegenerate] = useState(true);

    // スロットの対戦者表示名（選手名・チーム名）を組み立て
    const getSlotDisplayLabel = (slot: MatchSlot): string => {
        if (slot.source_type === 'bye') return '不戦勝';
        if (slot.source_type === 'winner') return '勝者';
        if (slot.source_type === 'loser') return '敗者';
        if (slot.source_type === 'entry' && (slot.entry_id || slot.tournament_entries)) {
            const ent = slot.tournament_entries ?? entries.find((e) => e.id === slot.entry_id);
            const displayName = ent?.custom_display_name ?? ent?.teams?.name ?? 'エントリー';
            const teamName = ent?.teams?.name;
            if (teamName && displayName !== teamName) return `${displayName}（${teamName}）`;
            return displayName;
        }
        return '未設定';
    };

    // 試合カードのタイトル（対戦選手名・チーム名。団体戦はチーム名のみ）
    const getMatchTitle = (match: Match): string => {
        if (match.match_pairs && match.match_pairs.length >= 2) {
            const a = match.match_pairs[0].teams?.name || 'チーム1';
            const b = match.match_pairs[1].teams?.name || 'チーム2';
            return `${a} vs ${b}`;
        }
        if (match.match_pairs && match.match_pairs.length === 1) {
            const a = match.match_pairs[0].teams?.name || 'チーム1';
            return `${a} vs -`;
        }
        if (match.match_slots && match.match_slots.length >= 2) {
            const a = getSlotDisplayLabel(match.match_slots[0]);
            const b = getSlotDisplayLabel(match.match_slots[1]);
            return `${a} vs ${b}`;
        }
        if (match.match_slots && match.match_slots.length === 1) {
            return `${getSlotDisplayLabel(match.match_slots[0])} vs -`;
        }
        return `試合 #${match.match_number}`;
    };

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // 3つのAPIを並列で取得
            const [tournamentRes, drawRes, entriesRes] = await Promise.all([
                fetch(`/api/tournaments/${tournamentId}`),
                fetch(`/api/tournaments/${tournamentId}/draw/tree`),
                fetch(`/api/tournaments/${tournamentId}/entries`).catch(() => null),
            ]);

            // 大会情報
            const tournamentData = await tournamentRes.json();
            if (tournamentRes.ok) {
                setTournament(tournamentData);
            }

            // ドロー
            const drawData = await drawRes.json();
            if (drawRes.ok) {
                setPhases(drawData.phases || []);
                const flatMatches = (drawData.rounds ?? []).flatMap((r: { matches: Match[] }) => r.matches);
                setMatches(flatMatches);
                setCanRegenerate(drawData.can_regenerate !== false);
                if (drawData.phases && drawData.phases.length > 0) {
                    setSelectedPhase(drawData.phases[0].id);
                }
            } else {
                const msg = drawData.details
                    ? `${drawData.error || 'ドローの取得に失敗しました'}\n${drawData.details}`
                    : (drawData.error || 'ドローの取得に失敗しました');
                setError(msg);
                console.error('Draw fetch error:', drawData);
            }

            // エントリー一覧（手動編集用）
            if (entriesRes && entriesRes.ok) {
                const entriesData = await entriesRes.json();
                setEntries(entriesData.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch draw:', err);
            setError('ドローの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleGenerate = async () => {
        if (!tournamentId) {
            toast.error('大会情報の読み込みに失敗しています。ページを再読み込みしてください。');
            return;
        }
        if (entries.length === 0) {
            toast.error('エントリーが登録されていません。先にエントリー管理でチーム・選手を登録してください。');
            return;
        }
        if (!canRegenerate) {
            toast.error('試合が開始または終了済みのため、ドローを再生成できません。スコアや結果がある試合がある場合は再生成を禁止しています。');
            return;
        }
        const ok = await confirmAsync({
            title: '確認',
            message: '既存のドローは上書きされます。よろしいですか？',
            confirmLabel: '再生成する',
        });
        if (!ok) return;

        try {
            setIsGenerating(true);
            const csrfHeaders = getCsrfHeaders();
            if (!csrfHeaders['X-CSRF-Token']) {
                toast.error('セキュリティのため、ページを再読み込みしてから再度お試しください。');
                return;
            }
            const response = await fetch(`/api/tournaments/${tournamentId}/draw/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...csrfHeaders },
                body: JSON.stringify({ umpire_initial: umpireInitial }),
            });

            let result: { error?: string; details?: string; code?: string };
            try {
                result = await response.json();
            } catch {
                const text = await response.text();
                console.error('Draw generate error: non-JSON response', response.status, text?.slice(0, 200));
                toast.error(`ドローの生成に失敗しました（${response.status}）。コンソールを確認してください。`);
                return;
            }

            if (!response.ok) {
                const isCsrfInvalid = response.status === 403 && (result as { code?: string }).code === 'E-CSRF-001';
                const msg = isCsrfInvalid
                    ? 'セキュリティトークンの有効期限が切れている可能性があります。ページを再読み込みしてから再度お試しください。'
                    : result.details
                        ? `${result.error || 'ドローの生成に失敗しました'}\n\n詳細: ${result.details}`
                        : (result.error || 'ドローの生成に失敗しました');
                console.error('Draw generate error:', response.status, result.error, result.details, result);
                toast.error(msg);
                return;
            }

            const resp = result as { entry_count?: number; matches_count?: number; bracket_size?: number };
            console.log('[ドロー生成結果] entry_count:', resp.entry_count, 'matches_count:', resp.matches_count, 'bracket_size:', resp.bracket_size, 'full:', result);
            toast.success('ドローを生成しました');
            fetchData();
        } catch (err) {
            console.error('Draw generate error:', err);
            const msg = err instanceof Error ? err.message : 'ドローの生成に失敗しました';
            if (msg === 'Failed to fetch') {
                toast.error('ネットワークエラーまたはサーバーが応答していません。接続を確認し、しばらく待ってから再試行してください。');
            } else {
                toast.error(msg);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredMatches = useMemo(() =>
        selectedPhase
            ? matches.filter(() => {
                  // phase_idでフィルタリング（実際のデータ構造に応じて調整）
                  return true;
              })
            : matches,
        [matches, selectedPhase]
    );

    const sortedRoundEntries = useMemo(() => {
        const groupedMatches = filteredMatches.reduce((acc, match) => {
            if (!acc[match.round_name]) {
                acc[match.round_name] = [];
            }
            acc[match.round_name].push(match);
            return acc;
        }, {} as Record<string, Match[]>);

        const roundOrder = ['1回戦', '2回戦', '3回戦', '4回戦', '5回戦', '6回戦', '準決勝', '決勝'];
        return Object.entries(groupedMatches).sort(([nameA, matchesA], [nameB, matchesB]) => {
            const idxA = matchesA[0]?.round_index ?? roundOrder.indexOf(nameA);
            const idxB = matchesB[0]?.round_index ?? roundOrder.indexOf(nameB);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            const ia = roundOrder.indexOf(nameA);
            const ib = roundOrder.indexOf(nameB);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return nameA.localeCompare(nameB);
        });
    }, [filteredMatches]);

    // ブラケット用: ラウンド別試合（round_index 昇順）、各ラウンド内は slot_index 昇順
    const { matchesByRound, roundIndices, maxRound, totalBracketRows } = useMemo(() => {
        const byRound = filteredMatches.reduce<Record<number, Match[]>>((acc, m) => {
            const r = m.round_index;
            if (!acc[r]) acc[r] = [];
            acc[r].push(m);
            return acc;
        }, {});
        Object.keys(byRound).forEach((r) => {
            byRound[Number(r)].sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0));
        });
        const indices = Object.keys(byRound)
            .map(Number)
            .sort((a, b) => a - b);
        const max = indices.length > 0 ? Math.max(...indices) : 1;
        return {
            matchesByRound: byRound,
            roundIndices: indices,
            maxRound: max,
            totalBracketRows: Math.pow(2, max),
        };
    }, [filteredMatches]);

    const handleEditMatch = (matchId: string) => {
        const match = matches.find((m) => m.id === matchId);
        if (!match) {
            toast.error('試合が見つかりません');
            return;
        }

        if (!match.match_slots || match.match_slots.length === 0) {
            toast.error('この試合にはスロット情報がありません。ドローを再生成してください。');
            return;
        }

        if (entries.length === 0) {
            toast.error('エントリー情報の取得に失敗しました。ページを再読み込みしてください。');
            return;
        }

        const slots: Record<string, Partial<MatchSlot>> = {};
        match.match_slots.forEach((slot) => {
            slots[slot.id] = {
                source_type: slot.source_type,
                entry_id: slot.entry_id,
                source_match_id: slot.source_match_id,
                placeholder_label: slot.placeholder_label,
            };
        });
        setEditingSlots(slots);
        setEditingMatch(matchId);
    };

    const handleCancelEdit = () => {
        setEditingMatch(null);
        setEditingSlots({});
    };

    const handleSaveEdit = async () => {
        if (!editingMatch) return;

        try {
            setIsSaving(true);
            const match = matches.find((m) => m.id === editingMatch);
            if (!match) {
                toast.error('試合が見つかりません');
                return;
            }

            if (!match.match_slots || match.match_slots.length === 0) {
                toast.error('この試合にはスロット情報がありません');
                return;
            }

            const slotsToUpdate = match.match_slots.map((slot) => {
                const edited = editingSlots[slot.id];
                const sourceType = edited?.source_type || slot.source_type;

                // バリデーション: source_typeに応じた必須フィールドチェック
                if (sourceType === 'entry' && !edited?.entry_id && !slot.entry_id) {
                    throw new Error(`スロット ${slot.slot_number} のエントリーを選択してください`);
                }
                if ((sourceType === 'winner' || sourceType === 'loser') && !edited?.source_match_id && !slot.source_match_id) {
                    throw new Error(`スロット ${slot.slot_number} の元試合を選択してください`);
                }

                return {
                    id: slot.id,
                    source_type: sourceType,
                    entry_id: sourceType === 'entry' ? (edited?.entry_id || slot.entry_id) : null,
                    source_match_id: (sourceType === 'winner' || sourceType === 'loser') ? (edited?.source_match_id || slot.source_match_id) : null,
                    placeholder_label: sourceType === 'bye' ? (edited?.placeholder_label || slot.placeholder_label || 'BYE') : null,
                };
            });

            const response = await fetch(`/api/tournaments/${tournamentId}/draw/slots`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ match_id: editingMatch, slots: slotsToUpdate }),
            });

            if (!response.ok) {
                const result = await response.json();
                toast.error(result.error || 'ドローの更新に失敗しました');
                return;
            }

            toast.success('ドローを更新しました');
            setEditingMatch(null);
            setEditingSlots({});
            fetchData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'ドローの更新に失敗しました';
            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

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
                            { label: tournament?.name || '大会', href: `/tournaments/${tournamentId}` },
                            { label: 'ドロー管理' },
                        ]}
                    />
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                ドロー管理
                            </h1>
                            {tournament && <p className="text-slate-400 mt-2">{tournament.name}</p>}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-slate-400 text-sm">審判の初期割り当て:</span>
                                <select
                                    value={umpireInitial}
                                    onChange={(e) => setUmpireInitial(e.target.value as 'guest' | 'unassigned' | 'me')}
                                    className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    <option value="me">自分（ドロー生成者）</option>
                                    <option value="guest">ゲスト審判</option>
                                    <option value="unassigned">未割り当て</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setViewMode(viewMode === 'list' ? 'bracket' : 'list')}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                                >
                                    {viewMode === 'list' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                                    {viewMode === 'list' ? 'ブラケット表示' : 'リスト表示'}
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !canRegenerate || entries.length === 0}
                                    title={
                                        entries.length === 0
                                            ? '先にエントリーを登録してください'
                                            : !canRegenerate
                                            ? '試合開始または終了済みの試合があるため再生成できません'
                                            : undefined
                                    }
                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg shadow-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                    {isGenerating ? '生成中...' : matches.length > 0 ? 'ドローを再生成' : 'ドローを生成'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <TournamentSubNav tournamentId={tournamentId} />

                {/* Phase Selector */}
                {phases.length > 1 && (
                    <div className="mb-6 flex gap-2">
                        {phases.map((phase) => (
                            <button
                                key={phase.id}
                                onClick={() => setSelectedPhase(phase.id)}
                                className={`px-4 py-2 rounded-lg transition-colors ${
                                    selectedPhase === phase.id
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            >
                                {phase.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400">{error}</p>
                    </div>
                )}

                {/* Matches Display */}
                {matches.length === 0 ? (
                    <div className="text-center py-12">
                        {entries.length === 0 ? (
                            <>
                                <p className="text-slate-400 text-lg mb-4">先にエントリーを登録してください</p>
                                <p className="text-slate-500 text-sm mb-6">
                                    ドローを生成するには、エントリー管理でチーム・選手を登録する必要があります
                                </p>
                                <Link
                                    href={`/tournaments/${tournamentId}/entries`}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    エントリー管理へ
                                </Link>
                            </>
                        ) : (
                            <>
                                <p className="text-slate-400 text-lg mb-4">ドローが生成されていません</p>
                                <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !canRegenerate || entries.length === 0}
                            title={
                                entries.length === 0
                                    ? '先にエントリーを登録してください'
                                    : !canRegenerate
                                    ? '試合開始または終了済みの試合があるため再生成できません'
                                    : undefined
                            }
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg shadow-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all duration-200"
                        >
                            {isGenerating ? '生成中...' : 'ドローを生成'}
                        </button>
                            </>
                        )}
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="space-y-6">
                        {sortedRoundEntries.map(([roundName, roundMatches]) => (
                            <div key={roundName} className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
                                <h2 className="text-xl font-semibold text-white mb-4">{roundName}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {roundMatches.map((match) => (
                                        <div
                                            key={match.id}
                                            className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-purple-500 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <span className="text-sm font-medium text-white min-w-0 break-words line-clamp-2" title={getMatchTitle(match)}>
                                                    {getMatchTitle(match)}
                                                </span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {match.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleEditMatch(match.id)}
                                                            className="p-1 text-purple-400 hover:text-purple-300 transition-colors"
                                                            title="ドローを編集"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <span
                                                        className={`px-2 py-1 text-xs rounded ${
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
                                            </div>

                                            {editingMatch === match.id ? (
                                                <div className="space-y-3 mt-4">
                                                    {match.match_slots?.map((slot) => (
                                                        <div key={slot.id} className="space-y-2">
                                                            <label className="block text-xs text-slate-300">
                                                                スロット {slot.slot_number}
                                                            </label>
                                                            <select
                                                                value={editingSlots[slot.id]?.source_type || slot.source_type}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    if (value === 'entry' || value === 'winner' || value === 'loser' || value === 'bye') {
                                                                        setEditingSlots((prev) => ({
                                                                            ...prev,
                                                                            [slot.id]: {
                                                                                ...prev[slot.id],
                                                                                source_type: value,
                                                                                entry_id: value === 'entry' ? prev[slot.id]?.entry_id || null : null,
                                                                                source_match_id: value === 'winner' || value === 'loser' ? prev[slot.id]?.source_match_id || null : null,
                                                                                placeholder_label: value === 'bye' ? 'BYE' : null,
                                                                            },
                                                                        }));
                                                                    }
                                                                }}
                                                                className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                                                            >
                                                                <option value="entry">エントリー</option>
                                                                <option value="winner">勝者</option>
                                                                <option value="loser">敗者</option>
                                                                <option value="bye">不戦勝</option>
                                                            </select>
                                                            {(editingSlots[slot.id]?.source_type || slot.source_type) === 'entry' && (
                                                                <select
                                                                    value={editingSlots[slot.id]?.entry_id || slot.entry_id || ''}
                                                                    onChange={(e) => {
                                                                        setEditingSlots((prev) => ({
                                                                            ...prev,
                                                                            [slot.id]: {
                                                                                ...prev[slot.id],
                                                                                entry_id: e.target.value || null,
                                                                            },
                                                                        }));
                                                                    }}
                                                                    className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                                                                >
                                                                    <option value="">選択してください</option>
                                                                    {entries.map((entry) => (
                                                                        <option key={entry.id} value={entry.id}>
                                                                            {entry.teams?.name || `エントリー ${entry.id.slice(0, 8)}`}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div className="flex gap-2 mt-4">
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            disabled={isSaving}
                                                            className="flex-1 flex items-center justify-center gap-1 px-4 py-3 min-h-[48px] bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
                                                        >
                                                            <Save className="w-3 h-3" />
                                                            保存
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="flex items-center justify-center gap-1 px-4 py-3 min-h-[48px] bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700"
                                                        >
                                                            <X className="w-3 h-3" />
                                                            キャンセル
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {match.match_pairs && match.match_pairs.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {match.match_pairs.map((pair, idx) => (
                                                                <div key={pair.id} className="text-sm text-white">
                                                                    {pair.teams?.name || `チーム${idx + 1}`}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : match.match_slots && match.match_slots.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {match.match_slots.map((slot) => (
                                                                <div key={slot.id} className="text-sm text-white">
                                                                    {getSlotDisplayLabel(slot)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                    {match.match_scores && (
                                                        <div className="mt-2 text-sm text-slate-300">
                                                            スコア: {match.match_scores.game_count_a} - {match.match_scores.game_count_b}
                                                        </div>
                                                    )}
                                                    <Link
                                                        href={`/matches/${match.id}?tournamentId=${tournamentId}`}
                                                        className="block mt-2 text-xs text-purple-400 hover:text-purple-300"
                                                    >
                                                        詳細を見る →
                                                    </Link>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 overflow-x-auto">
                        <div className="inline-flex gap-8 min-w-max">
                            {roundIndices.map((roundIdx) => {
                                const roundMatches = matchesByRound[roundIdx] ?? [];
                                const roundLabel =
                                    roundIdx === maxRound
                                        ? '決勝'
                                        : roundIdx === maxRound - 1
                                        ? '準決勝'
                                        : `${roundIdx}回戦`;
                                const rowSpan = Math.pow(2, roundIdx);
                                return (
                                    <div
                                        key={roundIdx}
                                        className="flex flex-col shrink-0"
                                        style={{
                                            width: '220px',
                                            display: 'grid',
                                            gridTemplateRows: `28px repeat(${totalBracketRows}, 52px)`,
                                            gap: '4px 0',
                                        }}
                                    >
                                        <div className="text-slate-400 text-sm font-medium text-center sticky top-0">
                                            {roundLabel}
                                        </div>
                                        {roundMatches.map((match) => {
                                            const slotIndex = match.slot_index ?? 0;
                                            const rowStart = slotIndex * rowSpan;
                                            const slotLabelA =
                                                match.match_slots && match.match_slots[0]
                                                    ? getSlotDisplayLabel(match.match_slots[0])
                                                    : match.match_pairs?.[0]?.teams?.name ?? '—';
                                            const slotLabelB =
                                                match.match_slots && match.match_slots[1]
                                                    ? getSlotDisplayLabel(match.match_slots[1])
                                                    : match.match_pairs?.[1]?.teams?.name ?? '—';
                                            const score =
                                                match.match_scores != null
                                                    ? `${match.match_scores.game_count_a} - ${match.match_scores.game_count_b}`
                                                    : null;
                                            return (
                                                <div
                                                    key={match.id}
                                                    className="flex items-center"
                                                    style={{
                                                        gridRow: `${rowStart + 2} / span ${rowSpan}`,
                                                    }}
                                                >
                                                    <Link
                                                        href={`/matches/${match.id}?tournamentId=${tournamentId}`}
                                                        className="block w-full rounded-lg border border-slate-600 bg-slate-700/80 hover:border-purple-500 hover:bg-slate-700 transition-colors overflow-hidden"
                                                    >
                                                        <div className="flex flex-col text-sm">
                                                            <div className="px-2 py-1.5 truncate border-b border-slate-600 bg-slate-800/50 text-slate-200">
                                                                {slotLabelA}
                                                            </div>
                                                            <div className="px-2 py-1.5 truncate border-b border-slate-600 bg-slate-800/50 text-slate-200">
                                                                {slotLabelB}
                                                            </div>
                                                            <div className="px-2 py-1 flex items-center justify-between">
                                                                {score != null ? (
                                                                    <span className="text-green-400 font-medium">{score}</span>
                                                                ) : (
                                                                    <span className="text-slate-500 text-xs">vs</span>
                                                                )}
                                                                <span
                                                                    className={`text-xs px-1.5 py-0.5 rounded ${
                                                                        match.status === 'finished'
                                                                            ? 'bg-green-500/20 text-green-400'
                                                                            : match.status === 'inprogress'
                                                                            ? 'bg-blue-500/20 text-blue-400'
                                                                            : 'bg-slate-500/20 text-slate-400'
                                                                    }`}
                                                                >
                                                                    {match.status === 'finished' ? '終了' : match.status === 'inprogress' ? '進行中' : '待機'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

