'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, List, Grid, Edit, Save, X } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import Breadcrumbs from '@/components/Breadcrumbs';

interface MatchSlot {
    id: string;
    slot_number: number;
    source_type: 'entry' | 'winner' | 'loser' | 'bye';
    entry_id: string | null;
    source_match_id: string | null;
    placeholder_label: string | null;
}

interface TournamentEntry {
    id: string;
    entry_type: string;
    teams?: {
        id: string;
        name: string;
        school_name: string;
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
            school_name: string;
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

    useEffect(() => {
        fetchData();
    }, [tournamentId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // 大会情報取得
            const tournamentRes = await fetch(`/api/tournaments/${tournamentId}`);
            const tournamentData = await tournamentRes.json();
            if (tournamentRes.ok) {
                setTournament(tournamentData);
            }

            // ドロー取得
            const drawRes = await fetch(`/api/tournaments/${tournamentId}/draw`);
            const drawData = await drawRes.json();
            if (drawRes.ok) {
                setPhases(drawData.phases || []);
                setMatches(drawData.matches || []);
                if (drawData.phases && drawData.phases.length > 0) {
                    setSelectedPhase(drawData.phases[0].id);
                }
            } else {
                setError(drawData.error || 'ドローの取得に失敗しました');
            }

            // エントリー一覧取得（手動編集用）
            try {
                const entriesRes = await fetch(`/api/tournaments/${tournamentId}/entries`);
                const entriesData = await entriesRes.json();
                if (entriesRes.ok) {
                    setEntries(entriesData.data || []);
                } else {
                    console.error('Failed to fetch entries:', entriesData.error);
                    // エントリー取得失敗は警告のみ（編集機能は使用不可になる）
                }
            } catch (err) {
                console.error('Failed to fetch entries:', err);
                // エントリー取得失敗は警告のみ
            }
        } catch (err) {
            console.error('Failed to fetch draw:', err);
            setError('ドローの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!confirm('既存のドローは上書きされます。よろしいですか？')) {
            return;
        }

        try {
            setIsGenerating(true);
            const response = await fetch(`/api/tournaments/${tournamentId}/draw/generate`, {
                method: 'POST',
            });

            const result = await response.json();
            if (!response.ok) {
                alert(result.error || 'ドローの生成に失敗しました');
                return;
            }

            alert('ドローを生成しました');
            fetchData();
        } catch (err) {
            alert('ドローの生成に失敗しました');
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredMatches = selectedPhase
        ? matches.filter((m) => {
              // phase_idでフィルタリング（実際のデータ構造に応じて調整）
              return true;
          })
        : matches;

    const groupedMatches = filteredMatches.reduce((acc, match) => {
        if (!acc[match.round_name]) {
            acc[match.round_name] = [];
        }
        acc[match.round_name].push(match);
        return acc;
    }, {} as Record<string, Match[]>);

    const handleEditMatch = (matchId: string) => {
        const match = matches.find((m) => m.id === matchId);
        if (!match) {
            alert('試合が見つかりません');
            return;
        }

        if (!match.match_slots || match.match_slots.length === 0) {
            alert('この試合にはスロット情報がありません。ドローを再生成してください。');
            return;
        }

        if (entries.length === 0) {
            alert('エントリー情報の取得に失敗しました。ページを再読み込みしてください。');
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
                alert('試合が見つかりません');
                return;
            }

            if (!match.match_slots || match.match_slots.length === 0) {
                alert('この試合にはスロット情報がありません');
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
                alert(result.error || 'ドローの更新に失敗しました');
                return;
            }

            alert('ドローを更新しました');
            setEditingMatch(null);
            setEditingSlots({});
            fetchData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'ドローの更新に失敗しました';
            alert(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 mb-8">
                    <div className="flex items-center justify-between py-4">
                        <Breadcrumbs
                            items={[
                                { label: '大会一覧', href: '/tournaments' },
                                { label: tournament?.name || '大会', href: `/tournaments/${tournamentId}` },
                                { label: 'ドロー管理' },
                            ]}
                        />
                        <div className="flex items-center gap-4">
                            <NotificationCenter />
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                ドロー管理
                            </h1>
                            {tournament && <p className="text-slate-400 mt-2">{tournament.name}</p>}
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
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg shadow-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                {isGenerating ? '生成中...' : 'ドロー自動生成'}
                            </button>
                        </div>
                    </div>
                </header>

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
                        <p className="text-slate-400 text-lg mb-4">ドローが生成されていません</p>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg shadow-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all duration-200"
                        >
                            {isGenerating ? '生成中...' : 'ドローを生成'}
                        </button>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="space-y-6">
                        {Object.entries(groupedMatches).map(([roundName, roundMatches]) => (
                            <div key={roundName} className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
                                <h2 className="text-xl font-semibold text-white mb-4">{roundName}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {roundMatches.map((match) => (
                                        <div
                                            key={match.id}
                                            className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-purple-500 transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-slate-400">試合 #{match.match_number}</span>
                                                <div className="flex items-center gap-2">
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
                                                                    setEditingSlots((prev) => ({
                                                                        ...prev,
                                                                        [slot.id]: {
                                                                            ...prev[slot.id],
                                                                            source_type: e.target.value as any,
                                                                            entry_id: e.target.value === 'entry' ? prev[slot.id]?.entry_id || null : null,
                                                                            source_match_id: e.target.value === 'winner' || e.target.value === 'loser' ? prev[slot.id]?.source_match_id || null : null,
                                                                            placeholder_label: e.target.value === 'bye' ? 'BYE' : null,
                                                                        },
                                                                    }));
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
                                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                                                        >
                                                            <Save className="w-3 h-3" />
                                                            保存
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-600 text-white rounded text-sm hover:bg-slate-700"
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
                                                                <div key={slot.id} className="text-sm text-slate-300">
                                                                    {slot.source_type === 'entry' && slot.entry_id
                                                                        ? entries.find((e) => e.id === slot.entry_id)?.teams?.name || 'エントリー'
                                                                        : slot.source_type === 'bye'
                                                                        ? '不戦勝'
                                                                        : slot.source_type === 'winner'
                                                                        ? '勝者'
                                                                        : slot.source_type === 'loser'
                                                                        ? '敗者'
                                                                        : '未設定'}
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
                                                        href={`/matches/${match.id}`}
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
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
                        <p className="text-slate-400 text-center">ブラケット表示は実装中です</p>
                    </div>
                )}
            </div>
        </div>
    );
}

