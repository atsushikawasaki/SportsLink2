'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const playerSchema = z.object({
    player_name: z.string().min(1, '選手名を入力してください'),
    player_type: z.enum(['前衛', '後衛', '両方'], {
        errorMap: () => ({ message: 'ポジションを選択してください' }),
    }),
});

type PlayerInput = z.infer<typeof playerSchema>;

interface Team {
    id: string;
    name: string;
    tournament_id: string;
}

export default function NewPlayerPage() {
    const params = useParams();
    const router = useRouter();
    const teamId = params.teamId as string;

    const [team, setTeam] = useState<Team | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loading, setLoading] = useState(true);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<PlayerInput>({
        resolver: zodResolver(playerSchema),
    });

    useEffect(() => {
        fetchTeam();
    }, [teamId]);

    const fetchTeam = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/teams/${teamId}`);
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'チームの取得に失敗しました');
                return;
            }

            setTeam(result);
        } catch (err) {
            console.error('Failed to fetch team:', err);
            setError('チームの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: PlayerInput) => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch(`/api/teams/${teamId}/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '選手の追加に失敗しました');
                return;
            }

            router.push(`/teams/${teamId}/players`);
        } catch {
            setError('選手の追加に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
            </div>
        );
    }

    if (error && !team) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                        <p className="text-red-400 text-center mb-4">{error}</p>
                        <Link
                            href="/teams"
                            className="block text-center text-green-400 hover:text-green-300 transition-colors"
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
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <Link
                            href={`/teams/${teamId}/players`}
                            className="flex items-center text-slate-400 hover:text-green-400 transition-colors mb-4"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            選手一覧に戻る
                        </Link>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                            選手登録
                        </h1>
                        {team && <p className="text-slate-400 mt-2">チーム: {team.name}</p>}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Player Name */}
                        <div>
                            <label htmlFor="player_name" className="block text-sm font-medium text-slate-300 mb-2">
                                選手名 <span className="text-red-400">*</span>
                            </label>
                            <input
                                {...register('player_name')}
                                type="text"
                                id="player_name"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                placeholder="選手名を入力"
                            />
                            {errors.player_name && (
                                <p className="mt-1 text-sm text-red-400">{errors.player_name.message}</p>
                            )}
                        </div>

                        {/* Player Type */}
                        <div>
                            <label htmlFor="player_type" className="block text-sm font-medium text-slate-300 mb-2">
                                ポジション <span className="text-red-400">*</span>
                            </label>
                            <select
                                {...register('player_type')}
                                id="player_type"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            >
                                <option value="">選択してください</option>
                                <option value="前衛">前衛</option>
                                <option value="後衛">後衛</option>
                                <option value="両方">両方</option>
                            </select>
                            {errors.player_type && (
                                <p className="mt-1 text-sm text-red-400">{errors.player_type.message}</p>
                            )}
                        </div>

                        {/* Submit Buttons */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {isLoading ? '登録中...' : '選手を登録'}
                            </button>
                            <Link
                                href={`/teams/${teamId}/players`}
                                className="px-6 py-3 bg-slate-700 text-white font-semibold rounded-lg shadow-lg hover:bg-slate-600 transition-all duration-200"
                            >
                                キャンセル
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

