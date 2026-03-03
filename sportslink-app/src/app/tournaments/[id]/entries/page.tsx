'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/lib/toast';
import { useParams } from 'next/navigation';
import { Plus, Upload, Download, CheckCircle, Search, Info } from 'lucide-react';
import AppShell from '@/components/AppShell';
import Breadcrumbs from '@/components/Breadcrumbs';
import TournamentSubNav from '@/components/TournamentSubNav';
import AuthKeyDisplay from '@/components/AuthKeyDisplay';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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

const playerEntrySchema = z
    .object({
        entryKind: z.enum(['singles', 'doubles']),
        region_name: z.string().optional(),
        player1_name: z.string().min(1, '選手1氏名を入力してください'),
        player1_affiliation: z.string().optional(),
        player2_name: z.string().optional(),
        player2_affiliation: z.string().optional(),
    })
    .refine(
        (data) => data.entryKind !== 'doubles' || (data.player2_name && data.player2_name.trim().length > 0),
        { message: '選手2氏名を入力してください', path: ['player2_name'] }
    );

type PlayerEntryInput = z.infer<typeof playerEntrySchema>;

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
    const [teamEntryRegion, setTeamEntryRegion] = useState('');

    const playerForm = useForm<PlayerEntryInput>({
        resolver: zodResolver(playerEntrySchema),
        defaultValues: {
            entryKind: 'singles',
            region_name: '',
            player1_name: '',
            player1_affiliation: '',
            player2_name: '',
            player2_affiliation: '',
        },
    });
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
                    toast.error(`CSVエクスポートに失敗しました: ${errorData.error || '不明なエラー'}`);
                } else {
                    toast.error(`CSVエクスポートに失敗しました (ステータス: ${response.status})`);
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
            toast.error(`CSVエクスポートに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
        }
    };

    const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('mode', csvImportMode || 'append');

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
                    toast.error(`CSVファイルにバリデーションエラーがあります: ${errorMessages}`);
                } else {
                    toast.error(result.error || 'CSVインポートに失敗しました');
                }
                return;
            }

            toast.success('CSVインポートが完了しました');
            fetchData();
        } catch {
            toast.error('CSVインポートに失敗しました');
        }
    };

    const handleCheckin = async (entryId: string) => {
        try {
            const response = await fetch(`/api/tournaments/${tournamentId}/entries/${entryId}/checkin`, {
                method: 'POST',
            });

            const result = await response.json();
            if (!response.ok) {
                toast.error(result.error || 'チェックインに失敗しました');
                return;
            }

            // 認証キーは通知センターに1回だけ表示
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

            toast.success('チェックイン完了しました');
            fetchData();
        } catch {
            toast.error('チェックインに失敗しました');
        }
    };

    const isTeamMatch = tournament?.match_format === 'team_doubles_3' || tournament?.match_format === 'team_doubles_4_singles_1';
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

    const handleSubmitPairEntry = async (data: PlayerEntryInput) => {
        if (!selectedTeam) return;
        const { entryKind, region_name, player1_name, player1_affiliation, player2_name, player2_affiliation } = data;
        setEntrySubmitError(null);
        setEntrySubmitLoading(true);
        try {
            const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entry_type: entryKind,
                    team_id: selectedTeam.id,
                    region_name: region_name?.trim() || null,
                    player1_name: player1_name.trim(),
                    player1_affiliation: player1_affiliation?.trim() || selectedTeam.name,
                    player2_name: entryKind === 'doubles' ? player2_name?.trim() : undefined,
                    player2_affiliation:
                        entryKind === 'doubles' ? (player2_affiliation?.trim() || selectedTeam.name) : undefined,
                }),
            });
            const result = await res.json();
            if (!res.ok) {
                setEntrySubmitError(result.error || 'エントリーの追加に失敗しました');
                return;
            }
            setShowPlayerModal(false);
            setSelectedTeam(null);
            playerForm.reset();
            fetchData();
        } catch {
            setEntrySubmitError('エントリーの追加に失敗しました');
        } finally {
            setEntrySubmitLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-[var(--color-bg-primary)] flex items-center justify-center min-h-screen">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <AppShell>
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
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mt-2">
                        エントリー管理
                    </h1>
                    {tournament && <p className="text-[var(--color-text-muted)] mt-2">{tournament.name}</p>}
                </div>

                <TournamentSubNav tournamentId={tournamentId} />

                {fetchError && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400">{fetchError}</p>
                    </div>
                )}

                {/* Stats Cards */}
                {!loading && activeTab === 'entries' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)]">
                            <p className="text-sm text-[var(--color-text-muted)] mb-1">エントリー総数</p>
                            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{entries.length}</p>
                        </div>
                        <div className="p-4 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)]">
                            <p className="text-sm text-[var(--color-text-muted)] mb-1">チェックイン済み</p>
                            <p className="text-2xl font-bold text-green-400">{entries.filter(e => e.is_checked_in).length}</p>
                        </div>
                        <div className="p-4 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)]">
                            <p className="text-sm text-[var(--color-text-muted)] mb-1">未チェックイン</p>
                            <p className="text-2xl font-bold text-yellow-400">{entries.filter(e => !e.is_checked_in).length}</p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-6 flex gap-2 border-b border-[var(--color-border-base)]" role="tablist" aria-label="エントリー管理">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'teams'}
                        aria-controls="panel-teams"
                        id="tab-teams"
                        onClick={() => setActiveTab('teams')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'teams'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                        }`}
                    >
                        チーム管理
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'entries'}
                        aria-controls="panel-entries"
                        id="tab-entries"
                        onClick={() => setActiveTab('entries')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'entries'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                        }`}
                    >
                        エントリー一覧
                    </button>
                </div>

                {/* 検索・件数（エントリータブ） */}
                {activeTab === 'entries' && (
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                        <div className="relative max-w-md flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
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
                                className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {searchQuery.trim() ? (
                                <>
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        <span className="text-blue-400 font-medium">{filteredEntries.length}</span> 件 / 全 {entries.length} 件
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setSearchQueryDisplay('');
                                        }}
                                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline"
                                    >
                                        検索をクリア
                                    </button>
                                </>
                            ) : (
                                <span className="text-sm text-[var(--color-text-muted)]">全 {entries.length} 件</span>
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
                        <span className="text-[var(--color-text-secondary)] text-sm">CSVインポート:</span>
                        <div className="flex items-center gap-1">
                            <select
                                value={csvImportMode}
                                onChange={(e) => setCsvImportMode(e.target.value as 'append' | 'update' | 'replace')}
                                className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] px-3 py-2 text-sm"
                                title={
                                    csvImportMode === 'append'
                                        ? '既存エントリーに追記します。重複があっても新規として追加されます。'
                                        : csvImportMode === 'update'
                                        ? 'region_name をキーに、同一キーの既存エントリーを上書き更新します。'
                                        : '既存エントリーを一度無効化し、CSVの内容で差し替えます。'
                                }
                            >
                                <option value="append">追加（既存に足す）</option>
                                <option value="update">更新（同一キーを上書き）</option>
                                <option value="replace">置換（既存を無効化して差し替え）</option>
                            </select>
                            <span
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] cursor-help"
                                title={
                                    csvImportMode === 'append'
                                        ? '既存エントリーに追記します。重複があっても新規として追加されます。'
                                        : csvImportMode === 'update'
                                        ? 'region_name をキーに、同一キーの既存エントリーを上書き更新します。'
                                        : '既存エントリーを一度無効化し、CSVの内容で差し替えます。'
                                }
                            >
                                <Info className="w-4 h-4" />
                            </span>
                        </div>
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
                    <div id="panel-teams" role="tabpanel" aria-labelledby="tab-teams" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map((team) => (
                            <div
                                key={team.id}
                                className="p-6 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)]"
                            >
                                <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">{team.name}</h3>
                                <p className="text-[var(--color-text-muted)] text-sm mb-4">代表チーム</p>
                                <div className="mb-4">
                                    <p className="text-[var(--color-text-secondary)] text-sm mb-2">
                                        選手数: {team.tournament_players?.length || 0}名
                                    </p>
                                    {team.tournament_players && team.tournament_players.length > 0 && (
                                        <div className="space-y-1">
                                            {team.tournament_players.map((player) => (
                                                <div key={player.id} className="text-xs text-[var(--color-text-muted)]">
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
                                            tournament?.match_format === 'individual_doubles' ||
                                            tournament?.match_format === 'team_doubles_3'
                                                ? 'doubles'
                                                : 'singles';
                                        playerForm.reset({
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
                        <a
                            href="/teams"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center p-6 bg-[var(--color-bg-surface)] rounded-xl border border-dashed border-[var(--color-border-base)] hover:border-blue-500 hover:bg-[var(--color-bg-surface-2)] transition-all min-h-[120px]"
                        >
                            <Plus className="w-8 h-8 text-[var(--color-text-muted)] mb-2" />
                            <span className="text-[var(--color-text-muted)] text-sm">新しいチームを作成</span>
                            <span className="text-[var(--color-text-muted)] text-xs mt-1">チーム管理ページへ</span>
                        </a>
                    </div>
                )}

                {activeTab === 'entries' && (
                    <div id="panel-entries" role="tabpanel" aria-labelledby="tab-entries" className="space-y-4">
                        {searchQuery.trim() && (
                            <p className="text-sm text-[var(--color-text-muted)]">
                                検索結果のみ表示しています（フィルター中）
                            </p>
                        )}
                        {filteredEntries.length === 0 ? (
                            <div className="p-8 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] text-center text-[var(--color-text-muted)]">
                                {searchQuery.trim()
                                    ? '検索条件に一致するエントリーがありません。検索をクリアしてください。'
                                    : 'エントリーがありません。'}
                            </div>
                        ) : (
                            filteredEntries.map((entry) => (
                            <div
                                key={entry.id}
                                className="p-4 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)]"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[var(--color-text-primary)] font-medium">
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
                                            <p className="text-[var(--color-text-muted)] text-sm">
                                                {entry.teams?.name && <span>代表: {entry.teams.name}</span>}
                                                {entry.teams?.name && entry.region_name && ' ・ '}
                                                {entry.region_name && <span>{entry.region_name}</span>}
                                                {!entry.teams?.name && !entry.region_name && '\u00A0'}
                                        </p>
                                        {entry.is_checked_in && entry.day_token && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[var(--color-text-muted)] text-sm">認証キー:</span>
                                                <AuthKeyDisplay token={entry.day_token} size="sm" />
                                            </div>
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
                        <div className="bg-[var(--color-bg-surface)] rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-[var(--color-border-base)] animate-fade-in">
                            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">チーム追加</h2>
                            <p className="text-[var(--color-text-muted)] mb-4">チームは「チーム一覧」ページで作成できます。作成後、ここでエントリーに追加できます。</p>
                            <button
                                onClick={() => setShowTeamModal(false)}
                                className="w-full px-4 py-2 bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-surface-2)] transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                )}

                {/* Player / Team Entry Modal */}
                {showPlayerModal && selectedTeam && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-[var(--color-bg-surface)] rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                            {isTeamMatch ? (
                                <>
                                    <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">チームをエントリーに追加</h2>
                                    <p className="text-[var(--color-text-muted)] text-sm mb-2">代表チーム名</p>
                                    <p className="text-[var(--color-text-primary)] font-medium mb-4">{selectedTeam.name}</p>
                                    <div className="mb-4">
                                        <label className="block text-sm text-[var(--color-text-muted)] mb-1">地域名</label>
                                        <input
                                            type="text"
                                            value={teamEntryRegion}
                                            onChange={(e) => setTeamEntryRegion(e.target.value)}
                                            className="w-full px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                            placeholder="任意"
                                        />
                                    </div>
                                    {entrySubmitError && (
                                        <p className="text-red-400 text-sm mb-4">{entrySubmitError}</p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSubmitTeamEntry}
                                            disabled={entrySubmitLoading}
                                            className="flex-1 px-4 py-3 min-h-[48px] bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[var(--color-bg-surface)]"
                                        >
                                            {entrySubmitLoading ? '追加中...' : '追加'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowPlayerModal(false);
                                                setSelectedTeam(null);
                                                setEntrySubmitError(null);
                                                setTeamEntryRegion('');
                                            }}
                                            className="px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-surface-2)] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[var(--color-bg-surface)]"
                                        >
                                            閉じる
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <form onSubmit={playerForm.handleSubmit(handleSubmitPairEntry)}>
                                    <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">エントリー追加 - {selectedTeam.name}</h2>
                                    {isMixedFormat && (
                                        <div className="mb-4">
                                            <span className="text-sm text-[var(--color-text-muted)] mr-3">種目</span>
                                            <label className="inline-flex items-center mr-4 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    {...playerForm.register('entryKind')}
                                                    value="singles"
                                                    className="mr-1"
                                                />
                                                <span className="text-[var(--color-text-primary)] text-sm">シングルス</span>
                                            </label>
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    {...playerForm.register('entryKind')}
                                                    value="doubles"
                                                    className="mr-1"
                                                />
                                                <span className="text-[var(--color-text-primary)] text-sm">ダブルス</span>
                                            </label>
                                        </div>
                                    )}
                                    <div className="mb-4">
                                        <label className="block text-sm text-[var(--color-text-muted)] mb-1">地域名（任意）</label>
                                        <input
                                            type="text"
                                            {...playerForm.register('region_name')}
                                            className="w-full px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                            placeholder="任意"
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm text-[var(--color-text-muted)] mb-1">選手1氏名 <span className="text-red-400">*</span></label>
                                        <input
                                            type="text"
                                            {...playerForm.register('player1_name')}
                                            className={`w-full px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] border rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent ${
                                                playerForm.formState.errors.player1_name ? 'border-red-500/50' : 'border-[var(--color-border-base)]'
                                            }`}
                                        />
                                        {playerForm.formState.errors.player1_name && (
                                            <p className="mt-1 text-sm text-red-400">
                                                {playerForm.formState.errors.player1_name.message}
                                            </p>
                                        )}
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm text-[var(--color-text-muted)] mb-1">選手1所属</label>
                                        <input
                                            type="text"
                                            {...playerForm.register('player1_affiliation')}
                                            className="w-full px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                            placeholder={selectedTeam.name}
                                        />
                                    </div>
                                    {(playerForm.watch('entryKind') === 'doubles' || isDoublesOnly) && (
                                        <>
                                            <div className="mb-4">
                                                <label className="block text-sm text-[var(--color-text-muted)] mb-1">選手2氏名 <span className="text-red-400">*</span></label>
                                                <input
                                                    type="text"
                                                    {...playerForm.register('player2_name')}
                                                    className={`w-full px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] border rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent ${
                                                        playerForm.formState.errors.player2_name ? 'border-red-500/50' : 'border-[var(--color-border-base)]'
                                                    }`}
                                                />
                                                {playerForm.formState.errors.player2_name && (
                                                    <p className="mt-1 text-sm text-red-400">
                                                        {playerForm.formState.errors.player2_name.message}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="mb-4">
                                                <label className="block text-sm text-[var(--color-text-muted)] mb-1">選手2所属</label>
                                                <input
                                                    type="text"
                                                    {...playerForm.register('player2_affiliation')}
                                                    className="w-full px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                                    placeholder={selectedTeam.name}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {entrySubmitError && (
                                        <p className="text-red-400 text-sm mb-4">{entrySubmitError}</p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            disabled={entrySubmitLoading}
                                            className="flex-1 px-4 py-3 min-h-[48px] bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[var(--color-bg-surface)]"
                                        >
                                            {entrySubmitLoading ? '追加中...' : '追加'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowPlayerModal(false);
                                                setSelectedTeam(null);
                                                setEntrySubmitError(null);
                                                setTeamEntryRegion('');
                                                playerForm.reset();
                                            }}
                                            className="px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-surface-2)] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[var(--color-bg-surface)]"
                                        >
                                            閉じる
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

