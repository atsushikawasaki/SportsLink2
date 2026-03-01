'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import Link from 'next/link';
import { AlertCircle, CheckCircle } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ConsentPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [consentStatus, setConsentStatus] = useState<any>(null);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [agreePrivacy, setAgreePrivacy] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        checkConsentStatus();
    }, [isAuthenticated, router]);

    // 無限リダイレクト防止: 再同意画面で再同意が不要な場合はダッシュボードにリダイレクト
    useEffect(() => {
        if (consentStatus && !consentStatus.needs_reconsent && isAuthenticated) {
            router.push('/dashboard');
        }
    }, [consentStatus, isAuthenticated, router]);

    const checkConsentStatus = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/auth/consent/check');
            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '同意状況の確認に失敗しました');
                return;
            }

            setConsentStatus(result);
            setAgreeTerms(result.terms?.needs_reconsent || false);
            setAgreePrivacy(result.privacy?.needs_reconsent || false);
        } catch (err) {
            setError('同意状況の確認に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!agreeTerms || !agreePrivacy) {
            setError('利用規約とプライバシーポリシーの両方に同意してください');
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            const response = await fetch('/api/auth/consent/reagree', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agree_terms: agreeTerms,
                    agree_privacy: agreePrivacy,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '再同意の処理に失敗しました');
                return;
            }

            router.push('/dashboard');
        } catch (err) {
            setError('再同意の処理に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAuthenticated || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    // 無限リダイレクト防止: 再同意が不要な場合はダッシュボードにリダイレクト
    if (consentStatus && !consentStatus.needs_reconsent) {
        // useEffectでリダイレクトするため、ここでは何も表示しない
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-2xl mx-auto px-4">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    <div className="text-center mb-8">
                        <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                            規約の更新
                        </h1>
                        <p className="text-slate-400 mt-2">
                            利用規約・プライバシーポリシーが更新されました。続行するには再同意が必要です。
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    <div className="space-y-6">
                        {consentStatus?.terms?.needs_reconsent && (
                            <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="agreeTerms"
                                        checked={agreeTerms}
                                        onChange={(e) => setAgreeTerms(e.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                                    />
                                    <div className="flex-1">
                                        <label htmlFor="agreeTerms" className="text-white font-medium">
                                            利用規約（バージョン {consentStatus.terms.current_version}）に同意します
                                        </label>
                                        <p className="text-sm text-slate-400 mt-1">
                                            以前の同意: バージョン {consentStatus.terms.agreed_version || 'なし'}
                                        </p>
                                        <Link
                                            href="/terms"
                                            target="_blank"
                                            className="text-sm text-blue-400 hover:text-blue-300 mt-2 inline-block"
                                        >
                                            利用規約を確認 →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}

                        {consentStatus?.privacy?.needs_reconsent && (
                            <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="agreePrivacy"
                                        checked={agreePrivacy}
                                        onChange={(e) => setAgreePrivacy(e.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                                    />
                                    <div className="flex-1">
                                        <label htmlFor="agreePrivacy" className="text-white font-medium">
                                            プライバシーポリシー（バージョン {consentStatus.privacy.current_version}）に同意します
                                        </label>
                                        <p className="text-sm text-slate-400 mt-1">
                                            以前の同意: バージョン {consentStatus.privacy.agreed_version || 'なし'}
                                        </p>
                                        <Link
                                            href="/privacy"
                                            target="_blank"
                                            className="text-sm text-blue-400 hover:text-blue-300 mt-2 inline-block"
                                        >
                                            プライバシーポリシーを確認 →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={!agreeTerms || !agreePrivacy || isSubmitting}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {isSubmitting ? '処理中...' : '同意して続行'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

