import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-6">
          Sport Link
        </h1>
        <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
          ソフトテニス大会運営支援システム
          <br />
          リアルタイムスコアリング・ドロー自動生成・オフライン対応
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
          >
            ログイン
          </Link>
          <Link
            href="/signup"
            className="px-8 py-4 bg-slate-700/50 text-white font-semibold rounded-xl border border-slate-600 hover:bg-slate-700 transition-all duration-200"
          >
            新規登録
          </Link>
        </div>
      </div>
    </div>
  );
}
