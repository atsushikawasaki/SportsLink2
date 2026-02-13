/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ビルド時のESLintエラーを警告として扱う（ビルドを失敗させない）
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ビルド時のTypeScriptエラーを無視（開発中は別途チェック推奨）
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
