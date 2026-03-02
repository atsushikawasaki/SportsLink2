import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteAccount } from '../deleteAccount';

// モック
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockDelete = vi.fn();
const mockDeleteUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
    from: mockFrom,
  })),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

describe('deleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockQueryChain = {
      eq: mockEq,
      single: mockSingle,
    };
    
    mockFrom.mockReturnValue({
      select: mockSelect,
      delete: mockDelete,
    });
    
    mockSelect.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
    mockDelete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('should return 400 when password is missing', async () => {
    const request = new Request('http://localhost/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({}),
    });

    const response = await deleteAccount(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('パスワードを入力してください');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new Request('http://localhost/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({
        password: 'password123',
      }),
    });

    const response = await deleteAccount(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 500 when user profile is not found', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new Request('http://localhost/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({
        password: 'password123',
      }),
    });

    const response = await deleteAccount(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('ユーザー情報の取得に失敗しました');
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 401 when password is incorrect', async () => {
    const bcrypt = await import('bcryptjs');
    (bcrypt.default.compare as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      },
      error: null,
    });

    const request = new Request('http://localhost/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({
        password: 'wrong-password',
      }),
    });

    const response = await deleteAccount(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('パスワードが正しくありません');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should delete account successfully', async () => {
    const bcrypt = await import('bcryptjs');
    (bcrypt.default.compare as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      },
      error: null,
    });

    mockDeleteUser.mockResolvedValue({
      data: {},
      error: null,
    });

    const request = new Request('http://localhost/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({
        password: 'password123',
      }),
    });

    const response = await deleteAccount(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('アカウントを削除しました');
  });

  it('should delete account even when password_hash is missing', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: null,
      },
      error: null,
    });

    mockDeleteUser.mockResolvedValue({
      data: {},
      error: null,
    });

    const request = new Request('http://localhost/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({
        password: 'password123',
      }),
    });

    const response = await deleteAccount(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('アカウントを削除しました');
  });

  it('should continue deletion even when auth deletion fails', async () => {
    const bcrypt = await import('bcryptjs');
    (bcrypt.default.compare as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      },
      error: null,
    });

    mockDeleteUser.mockResolvedValue({
      data: null,
      error: { message: 'Admin API not available' },
    });

    const request = new Request('http://localhost/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({
        password: 'password123',
      }),
    });

    const response = await deleteAccount(request);
    const data = await response.json();

    // Should still succeed even if auth deletion fails
    expect(response.status).toBe(200);
    expect(data.message).toContain('アカウントを削除しました');
  });

  it('should return 500 on database error', async () => {
    const bcrypt = await import('bcryptjs');
    (bcrypt.default.compare as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      },
      error: null,
    });

    mockDeleteUser.mockResolvedValue({
      data: {},
      error: null,
    });

    mockDelete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    });

    const request = new Request('http://localhost/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({
        password: 'password123',
      }),
    });

    const response = await deleteAccount(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('アカウントの削除に失敗しました');
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockGetUser.mockRejectedValue(new Error('Server error'));

    const request = new Request('http://localhost/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({
        password: 'password123',
      }),
    });

    const response = await deleteAccount(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('アカウントの削除に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

