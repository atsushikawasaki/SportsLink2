'use client';

export default function LoadingSpinner() {
    return (
        <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-slate-400">読み込み中...</p>
        </div>
    );
}
