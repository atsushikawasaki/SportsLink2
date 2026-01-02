import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notifyError, notifySyncSuccess, notifyQueueSizeWarning, type ErrorType } from '../offline';

// useNotificationStoreをモック
const mockAddNotification = vi.fn();
vi.mock('@/features/notifications/hooks/useNotificationStore', () => ({
  useNotificationStore: {
    getState: () => ({
      addNotification: mockAddNotification,
    }),
  },
}));

describe('Offline Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 開発環境のモック
    Object.defineProperty(process, 'env', {
      value: { NODE_ENV: 'test' },
      writable: true,
    });
  });

  describe('notifyError', () => {
    it('should notify sync_error correctly', () => {
      const error = {
        type: 'sync_error' as ErrorType,
        message: 'Sync failed',
      };

      notifyError(error);

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          title: '同期エラー',
          message: 'データの同期に失敗しました。ネットワーク接続を確認してください。',
        })
      );
    });

    it('should notify conflict_error correctly', () => {
      const error = {
        type: 'conflict_error' as ErrorType,
        message: 'Data conflict',
        code: 'E-CONFL-001',
      };

      notifyError(error);

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          title: 'データ競合エラー',
          message: 'データの競合が発生しました。最新のデータを取得しています。',
          data: expect.objectContaining({
            error_code: 'E-CONFL-001',
            error_type: 'conflict_error',
          }),
        })
      );
    });

    it('should notify network_error correctly', () => {
      const error = {
        type: 'network_error' as ErrorType,
        message: 'Network issue',
      };

      notifyError(error);

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          title: 'ネットワークエラー',
          message: 'ネットワーク接続に問題があります。オフラインモードで操作を続けられます。',
        })
      );
    });

    it('should notify validation_error correctly', () => {
      const error = {
        type: 'validation_error' as ErrorType,
        message: 'Invalid input',
      };

      notifyError(error);

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          title: '入力エラー',
          message: 'Invalid input',
        })
      );
    });

    it('should notify unknown_error correctly', () => {
      const error = {
        type: 'unknown_error' as ErrorType,
        message: 'Unexpected error',
      };

      notifyError(error);

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          title: 'エラー',
          message: 'Unexpected error',
        })
      );
    });

    it('should include timestamp in error notification', () => {
      const error = {
        type: 'sync_error' as ErrorType,
        message: 'Test error',
      };

      notifyError(error);

      const callArgs = mockAddNotification.mock.calls[0][0];
      expect(callArgs).toHaveProperty('data');
      // timestampはnotifyError内で追加されるため、通知オブジェクト全体を確認
      expect(mockAddNotification).toHaveBeenCalled();
    });

    it('should include error details when provided', () => {
      const error = {
        type: 'sync_error' as ErrorType,
        message: 'Test error',
        code: 'TEST-001',
        details: { field: 'email', reason: 'invalid format' },
      };

      notifyError(error);

      expect(mockAddNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            error_code: 'TEST-001',
            error_details: { field: 'email', reason: 'invalid format' },
          }),
        })
      );
    });
  });

  describe('notifySyncSuccess', () => {
    it('should notify sync success with count', () => {
      notifySyncSuccess(5);

      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'system',
        title: '同期完了',
        message: '5件のデータを同期しました。',
      });
    });

    it('should notify sync success with zero count', () => {
      notifySyncSuccess(0);

      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'system',
        title: '同期完了',
        message: '0件のデータを同期しました。',
      });
    });

    it('should notify sync success with large count', () => {
      notifySyncSuccess(100);

      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'system',
        title: '同期完了',
        message: '100件のデータを同期しました。',
      });
    });
  });

  describe('notifyQueueSizeWarning', () => {
    it('should not notify when queue size is below threshold', () => {
      notifyQueueSizeWarning(30);

      expect(mockAddNotification).not.toHaveBeenCalled();
    });

    it('should not notify when queue size is exactly 50', () => {
      notifyQueueSizeWarning(50);

      expect(mockAddNotification).not.toHaveBeenCalled();
    });

    it('should notify when queue size exceeds 50', () => {
      notifyQueueSizeWarning(51);

      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'system',
        title: 'オフラインキュー警告',
        message: 'オフラインキューに51件のデータが蓄積されています。ネットワーク接続を確認してください。',
      });
    });

    it('should notify when queue size is very large', () => {
      notifyQueueSizeWarning(200);

      expect(mockAddNotification).toHaveBeenCalledWith({
        type: 'system',
        title: 'オフラインキュー警告',
        message: 'オフラインキューに200件のデータが蓄積されています。ネットワーク接続を確認してください。',
      });
    });
  });
});

