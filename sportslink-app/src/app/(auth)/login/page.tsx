'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@/features/auth/types/schemas';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { setUser, setAccessToken } = useAuthStore();
    const router = useRouter();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginInput) => {
        setError(null);
        setIsLoading(true);

        try {
            // デバッグ用ログ（開発環境のみ）
            if (process.env.NODE_ENV === 'development') {
                console.log('Submitting login:', {
                    email: data.email,
                    hasPassword: !!data.password,
                });
            }

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: data.email.trim().toLowerCase(),
                    password: data.password,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                // 詳細なエラーメッセージを表示（開発環境の場合）
                let errorMessage = result.error || 'ログインに失敗しました';
                
                // デバッグ情報がある場合の追加メッセージ
                if (result.debug) {
                    if (!result.debug.userExists) {
                        errorMessage = 'このメールアドレスのユーザーは存在しません。サインアップを完了してください。';
                    } else if (!result.debug.emailConfirmed) {
                        errorMessage = 'メールアドレスの確認が必要です。登録時に送信されたメールを確認してください。';
                    } else {
                        errorMessage = 'パスワードが正しくありません。パスワードを確認してください。';
                    }
                } else if (result.details && result.details.includes('email not confirmed')) {
                    errorMessage = 'メールアドレスの確認が必要です。登録時に送信されたメールを確認してください。';
                } else if (result.details) {
                    errorMessage = `${result.error}\n詳細: ${result.details}`;
                }
                
                setError(errorMessage);
                console.error('Login failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: result,
                    debug: result.debug,
                    fullError: JSON.stringify(result, null, 2),
                });
                return;
            }

            setUser(result.user);
            setAccessToken(result.session.access_token);

            // 規約同意状況をチェック
            const consentRes = await fetch('/api/auth/consent/check');
            const consentData = await consentRes.json();
            if (consentRes.ok && consentData.needs_reconsent) {
                router.push('/consent');
            } else {
                router.push('/dashboard');
            }
        } catch {
            setError('ログインに失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="w-full max-w-md p-8">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            Sport Link
                        </h1>
                        <p className="text-slate-400 mt-2">ソフトテニス大会運営システム</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                                placeholder="••••••••"
                            />
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
                            )}
                        </div>

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
                            {isLoading ? 'ログイン中...' : 'ログイン'}
                        </button>
                    </form>

                    <div className="mt-6 text-center space-y-4">
                        <Link
                            href="/support/forgot-password"
                            className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
                        >
                            パスワードを忘れた場合
                        </Link>
                        <div className="border-t border-slate-700 pt-4">
                            <p className="text-slate-400">
                                アカウントをお持ちでない方は{' '}
                                <Link href="/signup" className="text-blue-400 hover:underline">
                                    新規登録
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
