/**
 * 規約・プライバシーポリシーのバージョン管理
 * 環境変数から取得、なければデフォルト値を使用
 */

export const CONSENT_VERSIONS = {
    TERMS: process.env.NEXT_PUBLIC_TERMS_VERSION || '1.0.0',
    PRIVACY: process.env.NEXT_PUBLIC_PRIVACY_VERSION || '1.0.0',
} as const;

/**
 * サーバーサイド用のバージョン取得
 * 環境変数から取得、なければデフォルト値を使用
 */
export function getConsentVersions() {
    return {
        terms: process.env.TERMS_VERSION || process.env.NEXT_PUBLIC_TERMS_VERSION || '1.0.0',
        privacy: process.env.PRIVACY_VERSION || process.env.NEXT_PUBLIC_PRIVACY_VERSION || '1.0.0',
    };
}

