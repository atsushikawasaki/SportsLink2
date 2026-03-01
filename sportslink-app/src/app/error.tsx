'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <h1 className="text-xl font-semibold text-red-400 mb-2">
        エラーが発生しました
      </h1>
      <p className="text-sm text-slate-400 mb-4 text-center max-w-md">
        読み込み中に問題が発生しました。ページを更新するか、しばらくしてから再度お試しください。
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
      >
        再試行
      </button>
      <Link
        href="/dashboard"
        className="mt-4 text-sm text-slate-400 hover:text-blue-400 transition-colors"
      >
        ダッシュボードへ戻る
      </Link>
    </div>
  );
}
