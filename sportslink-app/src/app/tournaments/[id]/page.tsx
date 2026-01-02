'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Settings, Users, Trophy, Calendar, Play, Award, Eye } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import Breadcrumbs from '@/components/Breadcrumbs';

interface Tournament {
    id: string;
    name: string;
    status: 'draft' | 'published' | 'finished';
    is_public: boolean;
    description: string | null;
    match_format: string | null;
    umpire_mode: 'LOSER' | 'ASSIGNED' | 'FREE';
    start_date: string | null;
    end_date: string | null;
    created_at: string;
}

export default function TournamentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const tournamentId = params.id as string;

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);

    useEffect(() => {
        fetchTournament();
    }, [tournamentId]);

    const fetchTournament = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/tournaments/${tournamentId}`);
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '大会の取得に失敗しました');
                return;
            }

            setTournament(result);
        } catch (err) {
            console.error('Failed to fetch tournament:', err);
            setError('大会の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!confirm('大会を公開しますか？')) {
            return;
        }

        try {
            setIsPublishing(true);
            const response = await fetch(`/api/tournaments/${tournamentId}/publish`, {
                method: 'POST',
            });

            if (!response.ok) {
                const result = await response.json();
                alert(result.error || '大会の公開に失敗しました');
                return;
            }

            fetchTournament();
        } catch (err) {
            alert('大会の公開に失敗しました');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleFinish = async () => {
        if (!confirm('大会を終了しますか？終了後は変更できません。')) {
            return;
        }

        try {
            setIsFinishing(true);
            const response = await fetch(`/api/tournaments/${tournamentId}/finish`, {
                method: 'POST',
            });

            if (!response.ok) {
                const result = await response.json();
                alert(result.error || '大会の終了に失敗しました');
                return;
            }

            fetchTournament();
        } catch (err) {
            alert('大会の終了に失敗しました');
        } finally {
            setIsFinishing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'published':
                return (
                    <span className="px-3 py-1 text-sm font-medium bg-green-500/20 text-green-400 rounded-full">
                        公開中
                    </span>
                );
            case 'finished':
                return (
                    <span className="px-3 py-1 text-sm font-medium bg-slate-500/20 text-slate-400 rounded-full">
                        終了
                    </span>
                );
            case 'draft':
            default:
                return (
                    <span className="px-3 py-1 text-sm font-medium bg-yellow-500/20 text-yellow-400 rounded-full">
                        下書き
                    </span>
                );
        }
    };

    const getUmpireModeLabel = (mode: string) => {
        switch (mode) {
            case 'LOSER':
                return '敗者審判モード';
            case 'ASSIGNED':
                return '運営割当モード';
            case 'FREE':
                return 'フリーモード';
            default:
                return mode;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                        <p className="text-red-400 text-center mb-4">{error || '大会が見つかりません'}</p>
                        <Link
                            href="/tournaments"
                            className="block text-center text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            大会一覧に戻る
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
                                { label: '大会一覧', href: '/tournaments' },
                                { label: tournament?.name || '大会詳細' },
                            ]}
                        />
                        <div className="flex items-center gap-4">
                            <NotificationCenter />
                        </div>
                    </div>
                </header>

                {/* Tournament Info */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8 mb-8">
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-4">
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                    {tournament.name}
                                </h1>
                                {getStatusBadge(tournament.status)}
                            </div>
                            {tournament.description && (
                                <p className="text-slate-300 mb-4">{tournament.description}</p>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {tournament.start_date && (
                                    <div>
                                        <p className="text-slate-400">開始日</p>
                                        <p className="text-white">
                                            {new Date(tournament.start_date).toLocaleDateString('ja-JP')}
                                        </p>
                                    </div>
                                )}
                                {tournament.end_date && (
                                    <div>
                                        <p className="text-slate-400">終了日</p>
                                        <p className="text-white">
                                            {new Date(tournament.end_date).toLocaleDateString('ja-JP')}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-slate-400">審判モード</p>
                                    <p className="text-white">{getUmpireModeLabel(tournament.umpire_mode)}</p>
                                </div>
                                {tournament.match_format && (
                                    <div>
                                        <p className="text-slate-400">試合形式</p>
                                        <p className="text-white">{tournament.match_format}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <Link
                            href={`/tournaments/${tournamentId}/edit`}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            <Edit className="w-4 h-4" />
                            編集
                        </Link>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                        {tournament.status === 'draft' && (
                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                <Play className="w-4 h-4" />
                                {isPublishing ? '公開中...' : '大会を公開'}
                            </button>
                        )}
                        {tournament.status === 'published' && (
                            <button
                                onClick={handleFinish}
                                disabled={isFinishing}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold rounded-lg shadow-lg hover:from-red-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                <Award className="w-4 h-4" />
                                {isFinishing ? '終了中...' : '大会を終了'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Management Menu */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Link
                        href={`/tournaments/${tournamentId}/entries`}
                        className="group p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
                    >
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                                <Users className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">エントリー管理</h3>
                        </div>
                        <p className="text-slate-400 text-sm">チーム・選手・ペアの管理</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/draw`}
                        className="group p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
                    >
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                                <Trophy className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">ドロー管理</h3>
                        </div>
                        <p className="text-slate-400 text-sm">ドローの生成・表示</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/assignments`}
                        className="group p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
                    >
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                                <Calendar className="w-6 h-6 text-green-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">試合割当</h3>
                        </div>
                        <p className="text-slate-400 text-sm">審判・コート番号の割り当て</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/roles`}
                        className="group p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
                    >
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-yellow-500/20 rounded-lg group-hover:bg-yellow-500/30 transition-colors">
                                <Settings className="w-6 h-6 text-yellow-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">権限管理</h3>
                        </div>
                        <p className="text-slate-400 text-sm">ユーザー権限の設定</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/results`}
                        className="group p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
                    >
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
                                <Award className="w-6 h-6 text-cyan-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">試合結果</h3>
                        </div>
                        <p className="text-slate-400 text-sm">試合結果の確認・管理</p>
                    </Link>

                    <Link
                        href={`/tournaments/${tournamentId}/live`}
                        className="group p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
                    >
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-red-500/20 rounded-lg group-hover:bg-red-500/30 transition-colors">
                                <Eye className="w-6 h-6 text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">リアルタイム観戦</h3>
                        </div>
                        <p className="text-slate-400 text-sm">ライブ試合の観戦</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}

