'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Breadcrumbs from '@/components/Breadcrumbs';

const tournamentSchema = z.object({
    name: z.string().min(1, '大会名を入力してください'),
    description: z.string().optional(),
    venue: z.string().optional(),
    status: z.enum(['draft', 'published', 'finished']).optional(),
    is_public: z.boolean().optional(),
    match_format: z.string().optional(),
    umpire_mode: z.enum(['LOSER', 'ASSIGNED', 'FREE']).default('LOSER'),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
});

type TournamentInput = z.infer<typeof tournamentSchema>;

const inputClass =
    'w-full px-4 py-3 bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent transition-all';

export default function NewTournamentPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<TournamentInput>({
        resolver: zodResolver(tournamentSchema),
        defaultValues: {
            status: 'draft',
            is_public: false,
            umpire_mode: 'LOSER',
        },
    });

    const onSubmit = async (data: TournamentInput) => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch('/api/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '大会の作成に失敗しました');
                return;
            }

            router.push(`/tournaments/${result.id}`);
        } catch {
            setError('大会の作成に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Breadcrumbs
                        items={[
                            { label: '大会一覧', href: '/tournaments' },
                            { label: '新規大会作成' },
                        ]}
                    />
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mt-4">新規大会作成</h1>
                </div>

                <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)] p-8">
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit as (data: TournamentInput) => void)} className="space-y-6">
                        {/* Name */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                大会名 <span className="text-red-400">*</span>
                            </label>
                            <input
                                {...register('name')}
                                type="text"
                                id="name"
                                className={inputClass}
                                placeholder="大会名を入力"
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
                            )}
                        </div>

                        {/* Venue */}
                        <div>
                            <label htmlFor="venue" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                会場
                            </label>
                            <input
                                {...register('venue')}
                                type="text"
                                id="venue"
                                className={inputClass}
                                placeholder="会場名を入力（例：○○テニスコート）"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                説明
                            </label>
                            <textarea
                                {...register('description')}
                                id="description"
                                rows={4}
                                className={inputClass}
                                placeholder="大会の説明を入力"
                            />
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="start_date" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    開始日
                                </label>
                                <input
                                    {...register('start_date')}
                                    type="date"
                                    id="start_date"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label htmlFor="end_date" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                    終了日
                                </label>
                                <input
                                    {...register('end_date')}
                                    type="date"
                                    id="end_date"
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        {/* Umpire Mode */}
                        <div>
                            <label htmlFor="umpire_mode" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                審判モード <span className="text-red-400">*</span>
                            </label>
                            <select
                                {...register('umpire_mode')}
                                id="umpire_mode"
                                className={inputClass}
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
                            <label htmlFor="match_format" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                試合形式
                            </label>
                            <select
                                {...register('match_format')}
                                id="match_format"
                                className={inputClass}
                            >
                                <option value="">選択してください</option>
                                <option value="team_doubles_3">団体戦（ダブルス3試合）</option>
                                <option value="team_doubles_4_singles_1">団体戦（ダブルス4試合+シングルス1試合）</option>
                                <option value="individual_doubles">個人戦（ダブルス）</option>
                                <option value="individual_singles">個人戦（シングルス）</option>
                            </select>
                        </div>

                        {/* Public */}
                        <div className="flex items-center">
                            <input
                                {...register('is_public')}
                                type="checkbox"
                                id="is_public"
                                className="h-4 w-4 rounded border-[var(--color-border-base)] bg-[var(--color-bg-surface-2)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                            />
                            <label htmlFor="is_public" className="ml-2 text-sm text-[var(--color-text-secondary)]">
                                公開設定（観戦者に公開）
                            </label>
                        </div>

                        {/* Submit Buttons */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 px-6 py-3 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {isLoading ? '作成中...' : '大会を作成'}
                            </button>
                            <Link
                                href="/tournaments"
                                className="px-6 py-3 bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] text-[var(--color-text-secondary)] font-semibold rounded-lg hover:border-[var(--color-border-strong)] transition-all duration-200"
                            >
                                キャンセル
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </AppShell>
    );
}
