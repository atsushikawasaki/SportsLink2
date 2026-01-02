'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, UserPlus, Plus, Upload, Download, CheckCircle, XCircle } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';

interface Team {
    id: string;
    name: string;
    school_name: string;
    tournament_players?: Array<{
        id: string;
        player_name: string;
        player_type: string;
    }>;
}

interface Entry {
    id: string;
    entry_type: 'team' | 'pair';
    is_checked_in: boolean;
    day_token: string | null;
    last_checked_in_at: string | null;
    teams?: Team;
    tournament_pairs?: any;
}

export default function EntriesPage() {
    const params = useParams();
    const router = useRouter();
    const tournamentId = params.id as string;

    const [tournament, setTournament] = useState<any>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'teams' | 'entries' | 'checkin'>('teams');
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

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
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleCSVExport = async () => {
        try {
            const response = await fetch(`/api/tournaments/${tournamentId}/entries/export`);
            if (!response.ok) {
                alert('CSVエクスポートに失敗しました');
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
            alert('CSVエクスポートに失敗しました');
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
                alert(result.error || 'CSVインポートに失敗しました');
                return;
            }

            alert('CSVインポートが完了しました');
            fetchData();
        } catch (err) {
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

            // 通知センターに認証キーを追加
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

            alert(`チェックイン完了！認証キー: ${result.day_token}`);
            fetchData();
        } catch (err) {
            alert('チェックインに失敗しました');
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 mb-8">
                    <div className="flex items-center justify-between py-4">
                        <Link
                            href={`/tournaments/${tournamentId}`}
                            className="flex items-center text-slate-400 hover:text-blue-400 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            大会詳細に戻る
                        </Link>
                        <div className="flex items-center gap-4">
                            <NotificationCenter />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mt-4">
                        エントリー管理
                    </h1>
                    {tournament && <p className="text-slate-400 mt-2">{tournament.name}</p>}
                </header>

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
                        チーム管理
                    </button>
                    <button
                        onClick={() => setActiveTab('entries')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'entries'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        エントリー一覧
                    </button>
                    <button
                        onClick={() => setActiveTab('checkin')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'checkin'
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        当日受付
                    </button>
                </div>

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
                    <div className="flex gap-2">
                        <label className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer">
                            <Upload className="w-4 h-4" />
                            CSVインポート
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
                                <p className="text-slate-400 text-sm mb-4">{team.school_name}</p>
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
                                        setShowPlayerModal(true);
                                    }}
                                    className="w-full px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                                >
                                    選手追加
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'entries' && (
                    <div className="space-y-4">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="p-4 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">
                                            {entry.entry_type === 'team'
                                                ? entry.teams?.name
                                                : 'ペアエントリー'}
                                        </p>
                                        <p className="text-slate-400 text-sm">
                                            {entry.entry_type === 'team' ? entry.teams?.school_name : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {entry.is_checked_in ? (
                                            <span className="flex items-center gap-1 text-green-400 text-sm">
                                                <CheckCircle className="w-4 h-4" />
                                                チェックイン済み
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-slate-400 text-sm">
                                                <XCircle className="w-4 h-4" />
                                                未チェックイン
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'checkin' && (
                    <div className="space-y-4">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="p-4 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">
                                            {entry.entry_type === 'team'
                                                ? entry.teams?.name
                                                : 'ペアエントリー'}
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
                                        <span className="text-green-400 text-sm">✓ チェックイン済み</span>
                                    )}
                                </div>
                            </div>
                        ))}
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

                {/* Player Modal (簡易版) */}
                {showPlayerModal && selectedTeam && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
                            <h2 className="text-xl font-semibold text-white mb-4">
                                選手追加 - {selectedTeam.name}
                            </h2>
                            <Link
                                href={`/teams/${selectedTeam.id}/players/new`}
                                className="block w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-center mb-2"
                            >
                                選手登録画面へ
                            </Link>
                            <button
                                onClick={() => {
                                    setShowPlayerModal(false);
                                    setSelectedTeam(null);
                                }}
                                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

