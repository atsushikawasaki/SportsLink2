'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Plus, Search, Trophy, Award } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';

interface Team {
    id: string;
    name: string;
    school_name: string;
    description: string | null;
    team_manager_user_id: string | null;
    created_at: string;
    tournament_players?: Array<{
        id: string;
        player_name: string;
        player_type: string;
    }>;
}

export default function TeamsPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        fetchTeams();
    }, [isAuthenticated, router]);

    const fetchTeams = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/teams?limit=100');
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'チーム一覧の取得に失敗しました');
                return;
            }

            setTeams(result.data || []);
        } catch (err) {
            console.error('Failed to fetch teams:', err);
            setError('チーム一覧の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const filteredTeams = teams.filter((team) => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                team.name.toLowerCase().includes(query) ||
                team.school_name.toLowerCase().includes(query) ||
                (team.description && team.description.toLowerCase().includes(query))
            );
        }
        return true;
    });

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 mb-8">
                    <div className="flex items-center justify-between py-4">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                            チーム一覧
                        </h1>
                        <div className="flex items-center gap-4">
                            <NotificationCenter />
                            <Link
                                href="/dashboard"
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                ダッシュボード
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Search and Actions */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="チーム名・学校名で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        />
                    </div>
                </div>

                {/* Teams List */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={fetchTeams}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                            再試行
                        </button>
                    </div>
                ) : filteredTeams.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg mb-2">
                            {teams.length === 0 ? 'チームがありません' : '条件に一致するチームがありません'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTeams.map((team) => (
                            <div
                                key={team.id}
                                className="p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold text-white mb-1">{team.name}</h3>
                                        <p className="text-slate-400 text-sm">{team.school_name}</p>
                                    </div>
                                </div>
                                {team.description && (
                                    <p className="text-slate-300 text-sm mb-4 line-clamp-2">{team.description}</p>
                                )}
                                <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                                    <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {team.tournament_players?.length || 0}名
                                    </span>
                                    <span>{new Date(team.created_at).toLocaleDateString('ja-JP')}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Link
                                        href={`/teams/${team.id}/players`}
                                        className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-center text-sm"
                                    >
                                        選手管理
                                    </Link>
                                    <button
                                        className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
                                        title="戦績確認（未実装）"
                                        disabled
                                    >
                                        <Trophy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Summary */}
                {!loading && teams.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-700">
                        <p className="text-sm text-slate-400 text-center">
                            全{teams.length}チーム中、{filteredTeams.length}チームを表示
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

