'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import Breadcrumbs from '@/components/Breadcrumbs';

interface Player {
    id: string;
    player_name: string;
    player_type: '前衛' | '後衛' | '両方';
    created_at: string;
}

interface Team {
    id: string;
    name: string;
}

export default function PlayersPage() {
    const params = useParams();
    const router = useRouter();
    const teamId = params.teamId as string;

    const [team, setTeam] = useState<Team | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [teamId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // チーム情報取得
            const teamRes = await fetch(`/api/teams/${teamId}`);
            const teamData = await teamRes.json();
            if (teamRes.ok) {
                setTeam(teamData);
            }

            // 選手一覧取得
            const playersRes = await fetch(`/api/teams/${teamId}/players`);
            const playersData = await playersRes.json();
            if (playersRes.ok) {
                setPlayers(playersData.players || []);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (playerId: string) => {
        if (!confirm('この選手を削除しますか？')) {
            return;
        }

        try {
            const response = await fetch(`/api/teams/players/${playerId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const result = await response.json();
                alert(result.error || '選手の削除に失敗しました');
                return;
            }

            fetchData();
        } catch (err) {
            alert('選手の削除に失敗しました');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
            </div>
        );
    }

    if (error || !team) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                        <p className="text-red-400 text-center mb-4">{error || 'チームが見つかりません'}</p>
                        <Link
                            href="/teams"
                            className="block text-center text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            チーム一覧に戻る
                        </Link>
                    </div>
                </div>
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
                                { label: 'チーム一覧', href: '/teams' },
                                { label: team.name, href: `/teams/${teamId}` },
                                { label: '選手一覧' },
                            ]}
                        />
                        <div className="flex items-center gap-4">
                            <NotificationCenter />
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                選手一覧
                            </h1>
                            <p className="text-slate-400 mt-2">{team.name}</p>
                        </div>
                        <Link
                            href={`/teams/${teamId}/players/new`}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                        >
                            <Plus className="w-5 h-5" />
                            選手を追加
                        </Link>
                    </div>
                </header>

                {/* Players List */}
                {players.length === 0 ? (
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-12 text-center">
                        <p className="text-slate-400 mb-4">選手が登録されていません</p>
                        <Link
                            href={`/teams/${teamId}/players/new`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                        >
                            <Plus className="w-5 h-5" />
                            選手を追加
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {players.map((player) => (
                            <div
                                key={player.id}
                                className="p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold text-white mb-2">{player.player_name}</h3>
                                        <span className="inline-block px-3 py-1 text-sm bg-blue-500/20 text-blue-400 rounded-full">
                                            {player.player_type}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => router.push(`/teams/${teamId}/players/${player.id}/edit`)}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
                                    >
                                        <Edit className="w-4 h-4" />
                                        編集
                                    </button>
                                    <button
                                        onClick={() => handleDelete(player.id)}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
