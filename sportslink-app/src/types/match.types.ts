// 試合ステータスの型定義
export type MatchStatus = 'pending' | 'inprogress' | 'paused' | 'finished';

// 試合ステータスフィルターの型定義（'all' を含む）
export type MatchStatusFilter = 'all' | MatchStatus;

// ステータスフィルターのバリデーション関数
export function isValidMatchStatus(value: string): value is MatchStatus {
    return ['pending', 'inprogress', 'paused', 'finished'].includes(value);
}

// ステータスフィルターのバリデーション関数（'all' を含む）
export function isValidMatchStatusFilter(value: string): value is MatchStatusFilter {
    return value === 'all' || isValidMatchStatus(value);
}
