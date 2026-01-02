'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MarkdownContent from '@/components/MarkdownContent';
import { CONSENT_VERSIONS } from '@/lib/consent-versions';

interface PrivacyDocument {
    content: string;
    version: string;
    lastUpdated: string | null;
}

export default function PrivacyPage() {
    const [document, setDocument] = useState<PrivacyDocument | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPrivacy();
    }, []);

    const loadPrivacy = async () => {
        try {
            setLoading(true);
            setError(null);

            // 最新バージョンを取得（環境変数から、または'latest'）
            // 環境変数が設定されている場合はそのバージョン、なければ'latest'を使用
            const version = CONSENT_VERSIONS.PRIVACY !== '1.0.0' ? CONSENT_VERSIONS.PRIVACY : 'latest';
            const response = await fetch(`/api/privacy/${version}`);

            if (!response.ok) {
                throw new Error('プライバシーポリシーの取得に失敗しました');
            }

            const data = await response.json();
            setDocument(data);
        } catch (err) {
            console.error('Failed to load privacy:', err);
            setError('プライバシーポリシーの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
            </div>
        );
    }

    if (error || !document) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                        <p className="text-red-400 text-center mb-4">{error || 'プライバシーポリシーが見つかりません'}</p>
                        <Link
                            href="/signup"
                            className="block text-center text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            新規登録に戻る
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
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                            プライバシーポリシー
                        </h1>
                        {document.lastUpdated && (
                            <p className="text-slate-400 text-sm">最終更新日: {document.lastUpdated}</p>
                        )}
                        <p className="text-slate-400 text-sm">バージョン: {document.version}</p>
                    </div>

                    <MarkdownContent content={document.content} />

                    <div className="mt-8 pt-8 border-t border-slate-700">
                        <Link
                            href="/signup"
                            className="inline-block py-3 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                        >
                            新規登録に戻る
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
