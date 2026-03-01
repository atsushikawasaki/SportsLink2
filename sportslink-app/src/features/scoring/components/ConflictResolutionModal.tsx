'use client';

import { AlertTriangle, RefreshCw, Play } from 'lucide-react';
import { useMatchStore } from '../hooks/useMatchStore';

interface ConflictResolutionModalProps {
    onUseServerScore: () => void;
}

export default function ConflictResolutionModal({ onUseServerScore }: ConflictResolutionModalProps) {
    const { hasConflict, clearConflict, gameCountA, gameCountB } = useMatchStore();

    if (!hasConflict) return null;

    const handleUseServer = () => {
        onUseServerScore();
        clearConflict();
    };

    const handleContinueLocal = () => {
        clearConflict();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-lg bg-red-500/20 p-2">
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">スコアの競合が発生しました</h2>
                        <p className="text-sm text-slate-400">
                            同時に別の操作が行われました
                        </p>
                    </div>
                </div>

                <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <p className="mb-2 text-sm text-slate-400">現在のローカルスコア</p>
                    <div className="flex items-center justify-center gap-4">
                        <span className="text-3xl font-bold text-blue-400">{gameCountA}</span>
                        <span className="text-slate-500">-</span>
                        <span className="text-3xl font-bold text-blue-400">{gameCountB}</span>
                    </div>
                </div>

                <p className="mb-6 text-sm text-slate-300">
                    サーバー側のデータと競合しています。どちらのスコアを使用しますか？
                </p>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleUseServer}
                        className="flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-600"
                    >
                        <RefreshCw className="h-4 w-4" />
                        サーバーの最新スコアを使用する
                    </button>
                    <button
                        onClick={handleContinueLocal}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 font-semibold text-slate-300 transition-colors hover:bg-slate-700"
                    >
                        <Play className="h-4 w-4" />
                        現在のスコアで続行する
                    </button>
                </div>
            </div>
        </div>
    );
}
