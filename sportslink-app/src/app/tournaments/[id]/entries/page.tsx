'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Upload, Download, CheckCircle, XCircle, Search } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Breadcrumbs from '@/components/Breadcrumbs';

interface Team {
    id: string;
    name: string;
    tournament_players?: Array<{
        id: string;
        player_name: string;
        player_type: string;
    }>;
}

interface Entry {
    id: string;
    entry_type: 'team' | 'doubles' | 'singles';
    is_checked_in: boolean;
    day_token: string | null;
    last_checked_in_at: string | null;
    region_name?: string | null;
    custom_display_name?: string | null;
    teams?: Team;
    tournament_pairs?: {
        id: string;
        player_1_id?: string;
        player_2_id?: string | null;
        player_1?: { player_name: string };
        player_2?: { player_name: string } | null;
    } | null;
}

type MatchFormat = 'team_doubles_3' | 'team_doubles_4_singles_1' | 'individual_doubles' | 'individual_singles' | null;

interface TournamentBasic {
    id: string;
    name: string;
    match_format?: MatchFormat;
}

export default function EntriesPage() {
    const params = useParams();
    const tournamentId = params.id as string;

    const [tournament, setTournament] = useState<TournamentBasic | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'teams' | 'entries'>('teams');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchQueryDisplay, setSearchQueryDisplay] = useState('');
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [playerForm, setPlayerForm] = useState({
        entryKind: 'singles' as 'singles' | 'doubles',
        region_name: '',
        player1_name: '',
        player1_affiliation: '',
        player2_name: '',
        player2_affiliation: '',
    });
    const [teamEntryRegion, setTeamEntryRegion] = useState('');
    const [entrySubmitLoading, setEntrySubmitLoading] = useState(false);
    const [entrySubmitError, setEntrySubmitError] = useState<string | null>(null);
    const [csvImportMode, setCsvImportMode] = useState<'append' | 'update' | 'replace'>('append');

    const filteredEntries = useMemo(() => {
        if (!searchQuery.trim()) return entries;
        const q = searchQuery.trim().toLowerCase();
        return entries.filter((entry) => {
            const teamName = entry.teams?.name?.toLowerCase() ?? '';
            const regionName = (entry.region_name ?? '').toLowerCase();
            const p1 = entry.tournament_pairs?.player_1?.player_name?.toLowerCase() ?? '';
            const p2 = entry.tournament_pairs?.player_2?.player_name?.toLowerCase() ?? '';
            return (
                teamName.includes(q) ||
                regionName.includes(q) ||
                p1.includes(q) ||
                p2.includes(q)
            );
        });
    }, [entries, searchQuery]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setFetchError(null);

            // 大会情報取得
            const tournamentRes = await fetch(`/api/tournaments/${tournamentId}`);
            const tournamentData = await tournamentRes.json();
            if (tournamentRes.ok) {
                setTournament(tournamentData);
            }

            // チーム一覧取得
            const teamsRes = await fetch(`/api/tournaments/${tournamentId}/teams`);
            const teamsData = await teamsRes.json();
            if (teamsRes.ok) {
                setTeams(teamsData || []);
            }

            // エントリー一覧取得
            const entriesRes = await fetch(`/api/tournaments/${tournamentId}/entries`);
            const entriesData = await entriesRes.json();
            if (entriesRes.ok) {
                setEntries(entriesData.data || []);
            }
        } catch (e) {
            console.error('Failed to fetch data:', e);
            setFetchError('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCSVExport = async () => {
        try {
            const response = await fetch(`/api/tournaments/${tournamentId}/entries/export`);
            if (!response.ok) {
                // エラーレスポンスをJSONとして読み取る
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    alert(`CSVエクスポートに失敗しました: ${errorData.error || '不明なエラー'}`);
                } else {
                    alert(`CSVエクスポートに失敗しました (ステータス: ${response.status})`);
                }
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tournament-${tournamentId}-entries.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('CSV export error:', err);
            alert(`CSVエクスポートに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
        }
    };

    const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`/api/tournaments/${tournamentId}/entries/import`, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            if (!response.ok) {
                // バリデーションエラーの場合は詳細を表示
                if (result.validationErrors && Array.isArray(result.validationErrors)) {
                    const errorMessages = result.validationErrors
                        .map((err: { row: number; message: string }) => `行${err.row}: ${err.message}`)
                        .join('\n');
                    alert(`CSVファイルにバリデーションエラーがあります:\n\n${errorMessages}`);
                } else {
                alert(result.error || 'CSVインポートに失敗しました');
                }
                return;
            }

            alert('CSVインポートが完了しました');
            fetchData();
        } catch {
            alert('CSVインポートに失敗しました');
        }
    };

    const handleCheckin = async (entryId: string) => {
        try {
            const response = await fetch(`/api/tournaments/${tournamentId}/entries/${entryId}/checkin`, {
                method: 'POST',
            });

            const result = await response.json();
            if (!response.ok) {
                alert(result.error || 'チェックインに失敗しました');
                return;
            }

            // 認証キーは通知センターに1回だけ表示（alertでは出さない）
            if (result.day_token) {
                const { useNotificationStore } = await import('@/features/notifications/hooks/useNotificationStore');
                const { addNotification } = useNotificationStore.getState();
                addNotification({
                    type: 'auth_key',
                    title: '認証キー発行',
                    message: `認証キー: ${result.day_token}`,
                    data: {
                        day_token: result.day_token,
                        tournament_id: tournamentId,
                    },
                });
            }

            alert('チェックイン完了しました');
            fetchData();
        } catch {
            alert('チェックインに失敗しました');
        }
    };

    const isTeamMatch = tournament?.match_format === 'team_doubles_3' || tournament?.match_format === 'team_doubles_4_singles_1';
    const isSinglesOnly = tournament?.match_format === 'individual_singles';
    const isDoublesOnly = tournament?.match_format === 'individual_doubles' || tournament?.match_format === 'team_doubles_3';
    const isMixedFormat = tournament?.match_format === 'team_doubles_4_singles_1';

    const handleSubmitTeamEntry = async () => {
        if (!selectedTeam) return;
        setEntrySubmitError(null);
        setEntrySubmitLoading(true);
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entry_type: 'team',
                    team_id: selectedTeam.id,
                    region_name: teamEntryRegion.trim() || null,
                }),
            });
            const result = await res.json();
            if (!res.ok) {
                setEntrySubmitError(result.error || 'エントリーの追加に失敗しました');
                return;
            }
            setShowPlayerModal(false);
            setSelectedTeam(null);
            setTeamEntryRegion('');
            fetchData();
        } catch {
            setEntrySubmitError('エントリーの追加に失敗しました');
        } finally {
            setEntrySubmitLoading(false);
        }
    };

    const handleSubmitPairEntry = async () => {
        if (!selectedTeam) return;
        const { entryKind, region_name, player1_name, player1_affiliation, player2_name, player2_affiliation } = playerForm;
        if (!player1_name.trim()) {
            setEntrySubmitError('選手1氏名を入力してください');
            return;
        }
        if (entryKind === 'doubles' && !player2_name.trim()) {
            setEntrySubmitError('選手2氏名を入力してください');
            return;
        }
        setEntrySubmitError(null);
        setEntrySubmitLoading(true);
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entry_type: entryKind,
                    team_id: selectedTeam.id,
                    region_name: region_name.trim() || null,
                    player1_name: player1_name.trim(),
                    player1_affiliation: player1_affiliation.trim() || selectedTeam.name,
                    player2_name: entryKind === 'doubles' ? player2_name.trim() : undefined,
                    player2_affiliation: entryKind === 'doubles' ? (player2_affiliation.trim() || selectedTeam.name) : undefined,
                }),
            });
            const result = await res.json();
            if (!res.ok) {
                setEntrySubmitError(result.error || 'エントリーの追加に失敗しました');
                return;
            }
            setShowPlayerModal(false);
            setSelectedTeam(null);
            setPlayerForm({ entryKind: 'singles', region_name: '', player1_name: '', player1_affiliation: '', player2_name: '', player2_affiliation: '' });
            fetchData();
        } catch {
            setEntrySubmitError('エントリーの追加に失敗しました');
        } finally {
            setEntrySubmitLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
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
                            { label: 'エントリー管理' },
                        ]}
                    />
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mt-2">
                        エントリー管理
                    </h1>
                    {tournament && <p className="text-slate-400 mt-2">{tournament.name}</p>}
                </div>

                {fetchError && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400">{fetchError}</p>
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-6 flex gap-2 border-b border-slate-700">
                    <button
                        onClick={() => setActiveTab('teams')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'teams'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        管理
                    </button>
                    <button
                        onClick={() => setActiveTab('entries')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'entries'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        一覧
                    </button>
                </div>

                {/* 検索・件数（エントリータブ） */}
                {activeTab === 'entries' && (
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                        <div className="relative max-w-md flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="チーム名・選手名・地域名で検索"
                                value={searchQueryDisplay}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setSearchQueryDisplay(v);
                                    if (!(e.nativeEvent as InputEvent).isComposing) {
                                        setSearchQuery(v);
                                    }
                                }}
                                onCompositionEnd={(e) => {
                                    const committed = e.currentTarget.value;
                                    setSearchQuery(committed);
                                    setSearchQueryDisplay(committed);
                                }}
                                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        {/* 件数は常に表示 */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {searchQuery.trim() ? (
                                <>
                                    <span className="text-sm text-slate-300">
                                        <span className="text-blue-400 font-medium">{filteredEntries.length}</span> 件 / 全 {entries.length} 件
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setSearchQueryDisplay('');
                                        }}
                                        className="text-sm text-slate-400 hover:text-white underline"
                                    >
                                        検索をクリア
                                    </button>
                                </>
                            ) : (
                                <span className="text-sm text-slate-400">全 {entries.length} 件</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="mb-6 flex flex-wrap gap-4">
                    {activeTab === 'teams' && (
                        <>
                            <button
                                onClick={() => setShowTeamModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                チーム追加
                            </button>
                        </>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-300 text-sm">CSVインポート:</span>
                        <select
                            value={csvImportMode}
                            onChange={(e) => setCsvImportMode(e.target.value as 'append' | 'update' | 'replace')}
                            className="rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-3 py-2 text-sm"
                        >
                            <option value="append">追加（既存に足す）</option>
                            <option value="update">更新（同一キーを上書き）</option>
                            <option value="replace">置換（既存を無効化して差し替え）</option>
                        </select>
                        <label className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer">
                            <Upload className="w-4 h-4" />
                            CSV選択
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleCSVImport}
                                className="hidden"
                            />
                        </label>
                        <button
                            onClick={handleCSVExport}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            CSVエクスポート
                        </button>
                    </div>
                </div>

                {/* Content */}
                {activeTab === 'teams' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map((team) => (
                            <div
                                key={team.id}
                                className="p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50"
                            >
                                <h3 className="text-xl font-semibold text-white mb-2">{team.name}</h3>
                                <p className="text-slate-400 text-sm mb-4">代表チーム</p>
                                <div className="mb-4">
                                    <p className="text-slate-300 text-sm mb-2">
                                        選手数: {team.tournament_players?.length || 0}名
                                    </p>
                                    {team.tournament_players && team.tournament_players.length > 0 && (
                                        <div className="space-y-1">
                                            {team.tournament_players.map((player) => (
                                                <div key={player.id} className="text-xs text-slate-400">
                                                    {player.player_name} ({player.player_type})
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedTeam(team);
                                        setEntrySubmitError(null);
                                        setTeamEntryRegion('');
                                        const kind: 'singles' | 'doubles' =
                                            tournament?.match_format === 'individual_doubles' || tournament?.match_format === 'team_doubles_3'
                                                ? 'doubles'
                                                : 'singles';
                                        setPlayerForm({
                                            entryKind: kind,
                                            region_name: '',
                                            player1_name: '',
                                            player1_affiliation: team.name,
                                            player2_name: '',
                                            player2_affiliation: '',
                                        });
                                        setShowPlayerModal(true);
                                    }}
                                    className="w-full px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                                >
                                    {isTeamMatch ? 'チームをエントリーに追加' : '選手追加'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'entries' && (
                    <div className="space-y-4">
                        {searchQuery.trim() && (
                            <p className="text-sm text-slate-400">
                                検索結果のみ表示しています（フィルター中）
                            </p>
                        )}
                        {filteredEntries.length === 0 ? (
                            <div className="p-8 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 text-center text-slate-400">
                                {searchQuery.trim()
                                    ? '検索条件に一致するエントリーがありません。検索をクリアしてください。'
                                    : 'エントリーがありません。'}
                            </div>
                        ) : (
                            filteredEntries.map((entry) => (
                            <div
                                key={entry.id}
                                className="p-4 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">
                                            {entry.entry_type === 'team'
                                                ? entry.teams?.name
                                                    : (() => {
                                                        const p1 = entry.tournament_pairs?.player_1?.player_name;
                                                        const p2 = entry.tournament_pairs?.player_2?.player_name;
                                                        if (p1 && p2) return `${p1} ・ ${p2}`;
                                                        if (p1) return p1;
                                                        return entry.custom_display_name ?? 'エントリー';
                                                    })()}
                                            </p>
                                            <p className="text-slate-400 text-sm">
                                                {entry.teams?.name && <span>代表: {entry.teams.name}</span>}
                                                {entry.teams?.name && entry.region_name && ' ・ '}
                                                {entry.region_name && <span>{entry.region_name}</span>}
                                                {!entry.teams?.name && !entry.region_name && '\u00A0'}
                                        </p>
                                        {entry.is_checked_in && entry.day_token && (
                                            <p className="text-blue-400 text-sm mt-1">
                                                認証キー: {entry.day_token}
                                            </p>
                                        )}
                                    </div>
                                    {!entry.is_checked_in ? (
                                        <button
                                            onClick={() => handleCheckin(entry.id)}
                                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                        >
                                            チェックイン
                                        </button>
                                    ) : (
                                            <span className="flex items-center gap-1 text-green-400 text-sm">
                                                <CheckCircle className="w-4 h-4" />
                                                チェックイン済み
                                            </span>
                                    )}
                                </div>
                            </div>
                            ))
                        )}
                    </div>
                )}

                {/* Team Modal (簡易版) */}
                {showTeamModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
                            <h2 className="text-xl font-semibold text-white mb-4">チーム追加</h2>
                            <p className="text-slate-400 mb-4">チーム追加機能は実装中です</p>
                            <button
                                onClick={() => setShowTeamModal(false)}
                                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                )}

                {/* Player / Team Entry Modal */}
                {showPlayerModal && selectedTeam && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                            {isTeamMatch ? (
                                <>
                                    <h2 className="text-xl font-semibold text-white mb-4">チームをエントリーに追加</h2>
                                    <p className="text-slate-400 text-sm mb-2">代表チーム名</p>
                                    <p className="text-white font-medium mb-4">{selectedTeam.name}</p>
                                    <div className="mb-4">
                                        <label className="block text-sm text-slate-400 mb-1">地域名</label>
                                        <input
                                            type="text"
                                            value={teamEntryRegion}
                                            onChange={(e) => setTeamEntryRegion(e.target.value)}
                                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                                            placeholder="任意"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-xl font-semibold text-white mb-4">エントリー追加 - {selectedTeam.name}</h2>
                                    {isMixedFormat && (
                                        <div className="mb-4">
                                            <span className="text-sm text-slate-400 mr-3">種目</span>
                                            <label className="inline-flex items-center mr-4">
                                                <input
                                                    type="radio"
                                                    checked={playerForm.entryKind === 'singles'}
                                                    onChange={() => setPlayerForm((p) => ({ ...p, entryKind: 'singles' }))}
                                                    className="mr-1"
                                                />
                                                <span className="text-white text-sm">シングルス</span>
                                            </label>
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    checked={playerForm.entryKind === 'doubles'}
                                                    onChange={() => setPlayerForm((p) => ({ ...p, entryKind: 'doubles' }))}
                                                    className="mr-1"
                                                />
                                                <span className="text-white text-sm">ダブルス</span>
                                            </label>
                                        </div>
                                    )}
                                    <div className="mb-4">
                                        <label className="block text-sm text-slate-400 mb-1">地域名（任意）</label>
                                        <input
                                            type="text"
                                            value={playerForm.region_name}
                                            onChange={(e) => setPlayerForm((p) => ({ ...p, region_name: e.target.value }))}
                                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm text-slate-400 mb-1">選手1氏名 <span className="text-red-400">*</span></label>
                                        <input
                                            type="text"
                                            value={playerForm.player1_name}
                                            onChange={(e) => setPlayerForm((p) => ({ ...p, player1_name: e.target.value }))}
                                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm text-slate-400 mb-1">選手1所属</label>
                                        <input
                                            type="text"
                                            value={playerForm.player1_affiliation}
                                            onChange={(e) => setPlayerForm((p) => ({ ...p, player1_affiliation: e.target.value }))}
                                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                            placeholder={selectedTeam.name}
                                        />
                                    </div>
                                    {(playerForm.entryKind === 'doubles' || isDoublesOnly) && (
                                        <>
                                            <div className="mb-4">
                                                <label className="block text-sm text-slate-400 mb-1">選手2氏名 <span className="text-red-400">*</span></label>
                                                <input
                                                    type="text"
                                                    value={playerForm.player2_name}
                                                    onChange={(e) => setPlayerForm((p) => ({ ...p, player2_name: e.target.value }))}
                                                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                                />
                                            </div>
                                            <div className="mb-4">
                                                <label className="block text-sm text-slate-400 mb-1">選手2所属</label>
                                                <input
                                                    type="text"
                                                    value={playerForm.player2_affiliation}
                                                    onChange={(e) => setPlayerForm((p) => ({ ...p, player2_affiliation: e.target.value }))}
                                                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                                    placeholder={selectedTeam.name}
                                                />
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                            {entrySubmitError && (
                                <p className="text-red-400 text-sm mb-4">{entrySubmitError}</p>
                            )}
                            <div className="flex gap-2">
                                {isTeamMatch ? (
                                    <button
                                        onClick={handleSubmitTeamEntry}
                                        disabled={entrySubmitLoading}
                                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                                    >
                                        {entrySubmitLoading ? '追加中...' : '追加'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmitPairEntry}
                                        disabled={entrySubmitLoading}
                                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                                    >
                                        {entrySubmitLoading ? '追加中...' : '追加'}
                                    </button>
                                )}
                            <button
                                onClick={() => {
                                    setShowPlayerModal(false);
                                    setSelectedTeam(null);
                                        setEntrySubmitError(null);
                                        setTeamEntryRegion('');
                                        setPlayerForm({ entryKind: 'singles', region_name: '', player1_name: '', player1_affiliation: '', player2_name: '', player2_affiliation: '' });
                                }}
                                    className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                            >
                                閉じる
                            </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

