import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendPasswordResetEmail } from '../sendPasswordResetEmail';

// Supabaseクライアントをモック
const mockResetPasswordForEmail = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  })),
}));

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when email is missing', async () => {
    const request = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await sendPasswordResetEmail(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('メールアドレスを入力してください');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when email is empty string', async () => {
    const request = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: '' }),
    });

    const response = await sendPasswordResetEmail(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('メールアドレスを入力してください');
  });

  it('should send password reset email successfully', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });

    const request = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
      }),
    });

    const response = await sendPasswordResetEmail(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('パスワードリセットメールを送信しました');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.objectContaining({
        redirectTo: expect.any(String),
      })
    );
  });

  it('should return success even when email does not exist (prevent enumeration)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'User not found' },
    });

    const request = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@example.com',
      }),
    });

    const response = await sendPasswordResetEmail(request);
    const data = await response.json();

    // Should still return 200 to prevent email enumeration
    expect(response.status).toBe(200);
    expect(data.message).toContain('パスワードリセットメールを送信しました');
  });

  it('should return 400 when Supabase returns error', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email format' },
    });

    const request = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
      }),
    });

    const response = await sendPasswordResetEmail(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid email format');
    expect(data.code).toBe('E-AUTH-004');
  });

  it('should return 500 on server error', async () => {
    mockResetPasswordForEmail.mockRejectedValue(new Error('Server error'));

    const request = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
      }),
    });

    const response = await sendPasswordResetEmail(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('パスワードリセットメールの送信に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

