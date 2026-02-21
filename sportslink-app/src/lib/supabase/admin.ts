import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * サーバーサイド専用のSupabase Admin Client
 * サービスロールキーを使用してRLSをバイパスします
 * 注意: このクライアントはサーバーサイドでのみ使用してください
 */
export function createAdminClient(): SupabaseClient<any> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    }

    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }

    return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }) as SupabaseClient<any>;
}

