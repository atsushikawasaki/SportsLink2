import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        ページが見つかりません
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-md hover:opacity-90 text-sm"
      >
        トップへ戻る
      </Link>
    </div>
  );
}
