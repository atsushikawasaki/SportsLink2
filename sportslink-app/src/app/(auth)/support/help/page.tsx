'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, HelpCircle, BookOpen, MessageCircle } from 'lucide-react';

interface FAQ {
    id: string;
    category: string;
    question: string;
    answer: string;
}

const faqs: FAQ[] = [
    {
        id: '1',
        category: '基本操作',
        question: '大会の作成方法を教えてください',
        answer: 'ダッシュボードから「新規大会作成」をクリックし、大会名、説明、試合形式などを入力して保存してください。',
    },
    {
        id: '2',
        category: '基本操作',
        question: 'チームや選手を追加するには？',
        answer: '大会詳細画面から「エントリー管理」を選択し、チーム追加・選手追加ボタンから追加できます。CSVインポートも利用可能です。',
    },
    {
        id: '3',
        category: 'スコア入力',
        question: 'スコアの入力方法を教えてください',
        answer: '担当試合一覧から試合を選択し、「スコア入力」ボタンをクリックします。敗者審判モードの場合は、認証キー（4桁）の入力が必要です。',
    },
    {
        id: '4',
        category: 'スコア入力',
        question: '認証キーはどこで確認できますか？',
        answer: '認証キーは通知センター（ヘッダーのベルアイコン）から確認できます。チェックイン時に発行された4桁の認証キーが表示されます。',
    },
    {
        id: '5',
        category: 'スコア入力',
        question: '誤ってポイントを入力してしまいました',
        answer: '「取り消し」ボタンで最新のポイントを取り消すことができます。試合終了後は大会運営者のみ取り消し可能です。',
    },
    {
        id: '6',
        category: 'ドロー管理',
        question: 'ドローを自動生成するには？',
        answer: '大会詳細画面から「ドロー管理」を選択し、「ドロー自動生成」ボタンをクリックします。既存のドローは上書きされます。',
    },
    {
        id: '7',
        category: '審判',
        question: '審判の割り当て方法を教えてください',
        answer: '大会詳細画面から「試合割当」を選択し、各試合に審判とコート番号を割り当てます。一括割り当て機能も利用できます。',
    },
    {
        id: '8',
        category: '審判',
        question: '敗者審判モードとは？',
        answer: '前試合の敗者が次の試合の審判を担当するモードです。試合終了時に自動的に次試合の審判権限が有効化されます。',
    },
    {
        id: '9',
        category: 'トラブルシューティング',
        question: 'オフライン時でもスコア入力できますか？',
        answer: 'はい、オフライン時でもスコア入力は可能です。入力したポイントはキューに保存され、オンライン復帰時に自動的に同期されます。',
    },
    {
        id: '10',
        category: 'トラブルシューティング',
        question: '試合を差し戻すには？',
        answer: '試合結果画面から終了した試合を選択し、「試合を差し戻す」ボタンをクリックします。大会運営者のみ実行可能です。',
    },
];

const categories = ['すべて', '基本操作', 'スコア入力', 'ドロー管理', '審判', 'トラブルシューティング'];

export default function HelpPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('すべて');

    const filteredFAQs = faqs.filter((faq) => {
        const matchesCategory = selectedCategory === 'すべて' || faq.category === selectedCategory;
        const matchesSearch =
            searchQuery === '' ||
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                            ヘルプセンター
                        </h1>
                        <p className="text-slate-400">よくある質問と操作ガイド</p>
                    </div>

                    {/* Search */}
                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="質問を検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="mb-6 flex flex-wrap gap-2">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    selectedCategory === category
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    {/* FAQ List */}
                    <div className="space-y-4">
                        {filteredFAQs.length === 0 ? (
                            <div className="text-center py-12">
                                <HelpCircle className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                                <p className="text-slate-400">該当する質問が見つかりませんでした</p>
                            </div>
                        ) : (
                            filteredFAQs.map((faq) => (
                                <div
                                    key={faq.id}
                                    className="p-6 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-slate-500 transition-all"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0 p-2 bg-blue-500/20 rounded-lg">
                                            <HelpCircle className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-1 text-xs font-medium bg-slate-600 text-slate-300 rounded">
                                                    {faq.category}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                                            <p className="text-slate-300 leading-relaxed">{faq.answer}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Quick Links */}
                    <div className="mt-8 pt-8 border-t border-slate-700">
                        <h2 className="text-xl font-semibold text-white mb-4">クイックリンク</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Link
                                href="/support/contact"
                                className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-slate-500 transition-all"
                            >
                                <MessageCircle className="w-6 h-6 text-blue-400" />
                                <div>
                                    <h3 className="text-white font-medium">お問い合わせ</h3>
                                    <p className="text-sm text-slate-400">質問や問題がある場合はこちら</p>
                                </div>
                            </Link>
                            <Link
                                href="/terms"
                                className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-slate-500 transition-all"
                            >
                                <BookOpen className="w-6 h-6 text-blue-400" />
                                <div>
                                    <h3 className="text-white font-medium">利用規約</h3>
                                    <p className="text-sm text-slate-400">利用規約とプライバシーポリシー</p>
                                </div>
                            </Link>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <Link
                            href="/"
                            className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
                        >
                            トップページに戻る
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

