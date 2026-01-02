import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetPassword } from '../resetPassword';

// モック
const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getSession: mockGetSession,
      updateUser: mockUpdateUser,
    },
    from: mockFrom,
  })),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password: string) => Promise.resolve(`hashed-${password}`)),
  },
}));

describe('resetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockFrom.mockReturnValue({
      update: mockUpdate,
    });
    
    mockUpdate.mockReturnValue({
      eq: mockEq,
    });
    
    mockEq.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it('should return 400 when password is missing', async () => {
    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await resetPassword(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('パスワードを入力してください');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when password is too short', async () => {
    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        password: '12345',
      }),
    });

    const response = await resetPassword(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('パスワードは6文字以上で入力してください');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when password is exactly 5 characters', async () => {
    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        password: '12345',
      }),
    });

    const response = await resetPassword(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('パスワードは6文字以上で入力してください');
  });

  it('should accept password with 6 characters', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
          },
        },
      },
      error: null,
    });

    mockUpdateUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        password: '123456',
      }),
    });

    const response = await resetPassword(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('パスワードをリセットしました');
  });

  it('should return 401 when session is invalid', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'No session' },
    });

    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        password: 'newpassword123',
      }),
    });

    const response = await resetPassword(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('無効または期限切れのリセットリンク');
    expect(data.code).toBe('E-AUTH-005');
  });

  it('should return 401 when session is missing', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        password: 'newpassword123',
      }),
    });

    const response = await resetPassword(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('無効または期限切れのリセットリンク');
  });

  it('should reset password successfully', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
          },
        },
      },
      error: null,
    });

    mockUpdateUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        password: 'newpassword123',
      }),
    });

    const response = await resetPassword(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('パスワードをリセットしました');
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: 'newpassword123',
    });
  });

  it('should return 400 when password update fails', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
          },
        },
      },
      error: null,
    });

    mockUpdateUser.mockResolvedValue({
      data: null,
      error: { message: 'Password too weak' },
    });

    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        password: 'newpassword123',
      }),
    });

    const response = await resetPassword(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Password too weak');
    expect(data.code).toBe('E-AUTH-006');
  });

  it('should return 500 on server error', async () => {
    mockGetSession.mockRejectedValue(new Error('Server error'));

    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        password: 'newpassword123',
      }),
    });

    const response = await resetPassword(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('パスワードのリセットに失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

