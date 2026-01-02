'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '@/features/auth/types/schemas';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<SignupInput>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            agreeTerms: false,
        },
    });

    const onSubmit = async (data: SignupInput) => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    displayName: data.displayName,
                    agreeTerms: data.agreeTerms,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'アカウント作成に失敗しました');
                return;
            }

            router.push('/login?registered=true');
        } catch {
            setError('アカウント作成に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="w-full max-w-md p-8">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            新規登録
                        </h1>
                        <p className="text-slate-400 mt-2">Sport Linkアカウントを作成</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <div>
                            <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-2">
                                表示名
                            </label>
                            <input
                                {...register('displayName')}
                                type="text"
                                id="displayName"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="山田 太郎"
                            />
                            {errors.displayName && (
                                <p className="mt-1 text-sm text-red-400">{errors.displayName.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                                メールアドレス
                            </label>
                            <input
                                {...register('email')}
                                type="email"
                                id="email"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="example@email.com"
                            />
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                                パスワード
                            </label>
                            <input
                                {...register('password')}
                                type="password"
                                id="password"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="6文字以上"
                            />
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                                パスワード（確認）
                            </label>
                            <input
                                {...register('confirmPassword')}
                                type="password"
                                id="confirmPassword"
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="パスワードを再入力"
                            />
                            {errors.confirmPassword && (
                                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
                            )}
                        </div>

                        <div className="flex items-start">
                            <input
                                {...register('agreeTerms')}
                                type="checkbox"
                                id="agreeTerms"
                                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
                            />
                            <label htmlFor="agreeTerms" className="ml-2 text-sm text-slate-400">
                                <Link href="/terms" className="text-blue-400 hover:underline">利用規約</Link>および
                                <Link href="/privacy" className="text-blue-400 hover:underline">プライバシーポリシー</Link>に同意します
                            </label>
                        </div>
                        {errors.agreeTerms && (
                            <p className="text-sm text-red-400">{errors.agreeTerms.message}</p>
                        )}

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {isLoading ? '登録中...' : 'アカウントを作成'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-slate-400">
                            既にアカウントをお持ちの方は{' '}
                            <Link href="/login" className="text-blue-400 hover:underline">
                                ログイン
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
