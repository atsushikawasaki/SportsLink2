import { defineConfig } from 'vitest/config';
import path from 'path';
import { config } from 'dotenv';

// 結合テスト（Supabase 接続）用: .env.local を先に読み、.env.test で上書き
config({ path: '.env.local' });
config({ path: '.env.test' });

export default defineConfig({
  plugins: [],
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
