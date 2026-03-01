'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Breadcrumbs from '@/components/Breadcrumbs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const tournamentSchema = z.object({
    name: z.string().min(1, '大会名を入力してください'),
    description: z.string().optional(),
    status: z.enum(['draft', 'published', 'finished']).optional(),
    is_public: z.boolean().optional(),
    match_format: z.string().optional(),
    umpire_mode: z.enum(['LOSER', 'ASSIGNED', 'FREE']).default('LOSER'),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
});

type TournamentInput = z.infer<typeof tournamentSchema>;

export default function EditTournamentPage() {
    const params = useParams();
    const router = useRouter();
    const tournamentId = params.id as string;

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tournament, setTournament] = useState<any>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<TournamentInput>({
        resolver: zodResolver(tournamentSchema) as any,
    });

    useEffect(() => {
        fetchTournament();
    }, [tournamentId]);

    const fetchTournament = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/tournaments/${tournamentId}`);
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '大会の取得に失敗しました');
                return;
            }

            // Format dates for input fields
            const tournamentData = {
                ...result,
                start_date: result.start_date ? result.start_date.split('T')[0] : '',
                end_date: result.end_date ? result.end_date.split('T')[0] : '',
            };

            setTournament(result);
            reset(tournamentData);
        } catch (err) {
            console.error('Failed to fetch tournament:', err);
            setError('大会の取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: TournamentInput) => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch(`/api/tournaments/${tournamentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '大会の更新に失敗しました');
                return;
            }

            router.push(`/tournaments/${tournamentId}`);
        } catch {
            setError('大会の更新に失敗しました');
        } finally {
            setIsLoading(false);
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
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    {/* Page Header */}
                    <div className="mb-8">
                        <Breadcrumbs
                            items={[
                                { label: '大会一覧', href: '/tournaments' },
                                { label: tournament?.name || '大会詳細', href: `/tournaments/${tournamentId}` },
                                { label: '大会編集' },
                            ]}
                        />
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mt-4">
                            大会編集
                        </h1>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit as (data: TournamentInput) => void)} className="space-y-6">
                        {/* Name */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                                大会名 <span className="text-red-400">*</span>
                            </label>
                            <input
                                {...register('name')}
                                type="text"
                                id="name"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="大会名を入力"
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
                                説明
                            </label>
                            <textarea
                                {...register('description')}
                                id="description"
                                rows={4}
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="大会の説明を入力"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-slate-300 mb-2">
                                ステータス
                            </label>
                            <select
                                {...register('status')}
                                id="status"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                <option value="draft">下書き</option>
                                <option value="published">公開中</option>
                                <option value="finished">終了</option>
                            </select>
                        </div>

                        {/* Umpire Mode */}
                        <div>
                            <label htmlFor="umpire_mode" className="block text-sm font-medium text-slate-300 mb-2">
                                審判モード <span className="text-red-400">*</span>
                            </label>
                            <select
                                {...register('umpire_mode')}
                                id="umpire_mode"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                <option value="LOSER">敗者審判モード（前試合の敗者が審判を担当）</option>
                                <option value="ASSIGNED">運営割当モード（運営が指名した審判のみ入力可能）</option>
                                <option value="FREE">フリーモード（誰でも入力可能、練習試合等）</option>
                            </select>
                            {errors.umpire_mode && (
                                <p className="mt-1 text-sm text-red-400">{errors.umpire_mode.message}</p>
                            )}
                        </div>

                        {/* Match Format */}
                        <div>
                            <label htmlFor="match_format" className="block text-sm font-medium text-slate-300 mb-2">
                                試合形式
                            </label>
                            <select
                                {...register('match_format')}
                                id="match_format"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                <option value="">選択してください</option>
                                <option value="team_doubles_3">団体戦（ダブルス3試合）</option>
                                <option value="team_doubles_4_singles_1">団体戦（ダブルス4試合+シングルス1試合）</option>
                                <option value="individual_doubles">個人戦（ダブルス）</option>
                                <option value="individual_singles">個人戦（シングルス）</option>
                            </select>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="start_date" className="block text-sm font-medium text-slate-300 mb-2">
                                    開始日
                                </label>
                                <input
                                    {...register('start_date')}
                                    type="date"
                                    id="start_date"
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label htmlFor="end_date" className="block text-sm font-medium text-slate-300 mb-2">
                                    終了日
                                </label>
                                <input
                                    {...register('end_date')}
                                    type="date"
                                    id="end_date"
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Public */}
                        <div className="flex items-center">
                            <input
                                {...register('is_public')}
                                type="checkbox"
                                id="is_public"
                                className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
                            />
                            <label htmlFor="is_public" className="ml-2 text-sm text-slate-300">
                                公開設定（観戦者に公開）
                            </label>
                        </div>

                        {/* Submit Buttons */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {isLoading ? '更新中...' : '更新'}
                            </button>
                            <Link
                                href={`/tournaments/${tournamentId}`}
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

