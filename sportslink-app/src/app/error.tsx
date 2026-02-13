'use client';

import { useEffect } from 'react';

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
        エラーが発生しました
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center max-w-md">
        読み込み中に問題が発生しました。ページを更新するか、しばらくしてから再度お試しください。
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-md hover:opacity-90 text-sm"
      >
        再試行
      </button>
    </div>
  );
}
