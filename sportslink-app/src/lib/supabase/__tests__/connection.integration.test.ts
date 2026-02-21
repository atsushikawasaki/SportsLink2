/**
 * Supabase 接続の結合テスト。
 * NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されている場合のみ実行し、
 * クライアント作成と getSession() で接続を確認する。
 * 環境変数が未設定の場合はスキップ（CI で DB が無い場合も他のテストは通る）。
 */
import { describe, it, expect } from 'vitest';
import { createClient } from '../client';

const hasSupabaseEnv =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;

describe.skipIf(!hasSupabaseEnv)('Supabase connection (integration)', () => {
  it(
    'should create client and get session without throwing',
    async () => {
      const supabase = createClient();
      expect(supabase).toBeDefined();
      expect(supabase.auth).toBeDefined();

      const { data, error } = await supabase.auth.getSession();
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.session).toBeDefined();
    },
    { timeout: 10000 }
  );
});
