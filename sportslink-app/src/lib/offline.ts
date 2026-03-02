import { useNotificationStore } from '@/features/notifications/hooks/useNotificationStore';

export type ErrorType = 'sync_error' | 'conflict_error' | 'network_error' | 'validation_error' | 'unknown_error';

export interface OfflineError {
    type: ErrorType;
    message: string;
    code?: string;
    details?: unknown;
    timestamp: string;
}

/**
 * エラー通知コールバック
 * オフライン操作や同期エラー時に通知を送信
 */
export function notifyError(error: Omit<OfflineError, 'timestamp'>) {
    const notificationStore = useNotificationStore.getState();
    const errorNotification: OfflineError = {
        ...error,
        timestamp: new Date().toISOString(),
    };

    // エラータイプに応じた通知メッセージを生成
    let title = 'エラーが発生しました';
    let message = error.message;

    switch (error.type) {
        case 'sync_error':
            title = '同期エラー';
            message = 'データの同期に失敗しました。ネットワーク接続を確認してください。';
            break;
        case 'conflict_error':
            title = 'データ競合エラー';
            message = 'データの競合が発生しました。最新のデータを取得しています。';
            break;
        case 'network_error':
            title = 'ネットワークエラー';
            message = 'ネットワーク接続に問題があります。オフラインモードで操作を続けられます。';
            break;
        case 'validation_error':
            title = '入力エラー';
            message = error.message || '入力データに問題があります。';
            break;
        case 'unknown_error':
        default:
            title = 'エラー';
            message = error.message || '予期しないエラーが発生しました。';
            break;
    }

    // 通知を追加
    notificationStore.addNotification({
        type: 'system',
        title,
        message,
        data: {
            error_code: error.code,
            error_type: error.type,
            error_details: error.details !== undefined ? String(error.details) : undefined,
        },
    });

    // コンソールにもログを出力（開発環境用）
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.error('Offline Error:', errorNotification);
    }
}

/**
 * 同期成功通知
 */
export function notifySyncSuccess(count: number) {
    const notificationStore = useNotificationStore.getState();
    notificationStore.addNotification({
        type: 'system',
        title: '同期完了',
        message: `${count}件のデータを同期しました。`,
    });
}

/**
 * オフラインキューサイズ警告
 */
export function notifyQueueSizeWarning(size: number) {
    const notificationStore = useNotificationStore.getState();
    if (size > 50) {
        notificationStore.addNotification({
            type: 'system',
            title: 'オフラインキュー警告',
            message: `オフラインキューに${size}件のデータが蓄積されています。ネットワーク接続を確認してください。`,
        });
    }
}

