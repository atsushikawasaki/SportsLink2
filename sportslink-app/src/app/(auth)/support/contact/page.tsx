'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const contactSchema = z.object({
    category: z.string().min(1, '問い合わせ種別を選択してください'),
    email: z.string().email('有効なメールアドレスを入力してください'),
    subject: z.string().min(1, '件名を入力してください'),
    message: z.string().min(10, '本文は10文字以上で入力してください'),
});

type ContactInput = z.infer<typeof contactSchema>;

export default function ContactPage() {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuthStore();
    const router = useRouter();

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
    } = useForm<ContactInput>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            email: user?.email || '',
        },
    });

    useEffect(() => {
        if (user?.email) {
            setValue('email', user.email);
        }
    }, [user, setValue]);

    const onSubmit = async (data: ContactInput) => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch('/api/support/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '送信に失敗しました');
                return;
            }

            setSuccess(true);
            setTimeout(() => {
                if (user) {
                    router.push('/dashboard');
                } else {
                    router.push('/');
                }
            }, 2000);
        } catch {
            setError('送信に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-2xl mx-auto px-4">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            お問い合わせ
                        </h1>
                        <p className="text-slate-400 mt-2">ご質問やご要望をお気軽にお寄せください</p>
                    </div>

                    {success ? (
                        <div className="space-y-6">
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <p className="text-sm text-green-400">
                                    お問い合わせを受け付けました。ありがとうございます。
                                </p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div>
                                <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-2">
                                    問い合わせ種別 <span className="text-red-400">*</span>
                                </label>
                                <select
                                    {...register('category')}
                                    id="category"
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                >
                                    <option value="">選択してください</option>
                                    <option value="technical">技術的な問題</option>
                                    <option value="feature">機能要望</option>
                                    <option value="other">その他</option>
                                </select>
                                {errors.category && (
                                    <p className="mt-1 text-sm text-red-400">{errors.category.message}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                                    メールアドレス <span className="text-red-400">*</span>
                                </label>
                                <input
                                    {...register('email')}
                                    type="email"
                                    id="email"
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="example@email.com"
                                    disabled={!!user?.email}
                                />
                                {errors.email && (
                                    <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
                                    件名 <span className="text-red-400">*</span>
                                </label>
                                <input
                                    {...register('subject')}
                                    type="text"
                                    id="subject"
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="件名を入力してください"
                                />
                                {errors.subject && (
                                    <p className="mt-1 text-sm text-red-400">{errors.subject.message}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
                                    本文 <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    {...register('message')}
                                    id="message"
                                    rows={8}
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                    placeholder="お問い合わせ内容を入力してください（10文字以上）"
                                />
                                {errors.message && (
                                    <p className="mt-1 text-sm text-red-400">{errors.message.message}</p>
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
                                {isLoading ? '送信中...' : '送信'}
                            </button>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        {user ? (
                            <Link
                                href="/dashboard"
                                className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
                            >
                                ダッシュボードに戻る
                            </Link>
                        ) : (
                            <Link
                                href="/"
                                className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
                            >
                                ログイン画面に戻る
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

