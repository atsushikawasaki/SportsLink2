'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Play, Eye } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import EmptyState from '@/components/ui/EmptyState';
import Breadcrumbs from '@/components/Breadcrumbs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Match {
    id: string;
    round_name: string;
    match_number: number;
    status: 'pending' | 'inprogress' | 'finished';
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
    tournaments?: {
        id: string;
        name: string;
    };
}

export default function AssignedMatchesPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated || !user) {
            router.push('/login');
            return;
        }

        fetchMatches();
    }, [isAuthenticated, user, router]);

    const fetchMatches = async () => {
        if (!user?.id) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/matches/umpire/${user.id}`);
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '試合一覧の取得に失敗しました');
                return;
            }

            setMatches(result.data || []);
        } catch (err) {
            console.error('Failed to fetch matches:', err);
            setError('試合一覧の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <AppHeader />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <Breadcrumbs items={[{ label: '担当試合一覧' }]} />
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mt-2">
                            担当試合一覧
                        </h1>
                    </div>

                {/* Matches List */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={fetchMatches}
                            className="px-4 py-3 min-h-[48px] bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                        >
                            再試行
                        </button>
                    </div>
                ) : matches.length === 0 ? (
                    <EmptyState
                        icon={Trophy}
                        title="担当試合がありません"
                        description="大会管理者に担当割り当てを依頼するか、大会一覧で役割を確認してください"
                        action={
                            <Link
                                href="/tournaments"
                                className="inline-block px-6 py-3 min-h-[48px] flex items-center justify-center bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                            >
                                大会一覧へ
                            </Link>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {matches.map((match) => (
                            <div
                                key={match.id}
                                className="p-6 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-white font-medium">
                                            {match.tournaments?.name || '大会'}
                                        </p>
                                        <p className="text-slate-400 text-sm">{match.round_name}</p>
                                        <p className="text-slate-500 text-xs">試合 #{match.match_number}</p>
                                    </div>
                                    <span
                                        className={`px-3 py-1 text-xs rounded-lg ${
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
                                {match.match_pairs && match.match_pairs.length > 0 && (
                                    <div className="mb-4 space-y-2">
                                        <div className="text-white">
                                            {match.match_pairs[0]?.teams?.name || 'チームA'}
                                        </div>
                                        <div className="text-slate-400 text-sm">vs</div>
                                        <div className="text-white">
                                            {match.match_pairs.length >= 2 ? (match.match_pairs[1]?.teams?.name || 'チームB') : 'チームB'}
                                        </div>
                                    </div>
                                )}
                                {match.match_scores && (
                                    <div className="flex items-center justify-center gap-4 mb-4 pt-4 border-t border-slate-700">
                                        <span className="text-2xl font-bold text-blue-400">
                                            {match.match_scores.game_count_a}
                                        </span>
                                        <span className="text-slate-400">-</span>
                                        <span className="text-2xl font-bold text-blue-400">
                                            {match.match_scores.game_count_b}
                                        </span>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    {match.status === 'pending' && (
                                        <Link
                                            href={`/scoring/${match.id}`}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                                        >
                                            <Play className="w-4 h-4" />
                                            試合開始
                                        </Link>
                                    )}
                                    {match.status === 'inprogress' && (
                                        <Link
                                            href={`/scoring/${match.id}`}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                                        >
                                            スコア入力
                                        </Link>
                                    )}
                                    <Link
                                        href={`/matches/${match.id}`}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
                                    >
                                        <Eye className="w-4 h-4" />
                                        詳細
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

