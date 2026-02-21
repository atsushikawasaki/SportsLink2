import { syncUsers } from './syncUsers';
import { createAuthUsers } from './createAuthUsers';
import { checkSyncStatus } from './checkSyncStatus';

/**
 * 既存のauth.usersをpublic.usersに同期するエンドポイント
 * 開発環境でのみ使用可能
 */
export async function POST(request: Request) {
    return syncUsers(request);
}

/**
 * public.usersに存在するがauth.usersに存在しないユーザーをauth.usersに作成する
 */
export async function PUT(request: Request) {
    return createAuthUsers(request);
}

/**
 * 同期前の状態を確認するエンドポイント
 */
export async function GET(request: Request) {
    return checkSyncStatus(request);
}
