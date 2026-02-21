import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePassword } from '../updatePassword';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockCompare = vi.fn();
const mockUpdateUser = vi.fn();
const mockHash = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser, updateUser: mockUpdateUser },
    from: mockFrom,
  })),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args: unknown[]) => mockCompare(...args),
    hash: (...args: unknown[]) => mockHash(...args),
  },
}));

describe('updatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHash.mockResolvedValue('hashed-new-password');
  });

  it('should return 400 when currentPassword or newPassword is missing', async () => {
    const request = new Request('http://localhost/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ newPassword: '12345678' }),
    });
    const response = await updatePassword(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('現在のパスワードと新しいパスワードを入力してください');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when newPassword is shorter than 8 characters', async () => {
    const request = new Request('http://localhost/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: 'oldpass12', newPassword: 'short' }),
    });
    const response = await updatePassword(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('8文字以上');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const request = new Request('http://localhost/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: 'oldpass12', newPassword: 'newpass12' }),
    });
    const response = await updatePassword(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 401 when current password is wrong', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-123', password_hash: 'hashed-old' },
      error: null,
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
    });
    mockCompare.mockResolvedValueOnce(false);

    const request = new Request('http://localhost/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: 'wrongpass', newPassword: 'newpass12' }),
    });
    const response = await updatePassword(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('現在のパスワードが正しくありません');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 500 when user profile fetch fails', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
    });

    const request = new Request('http://localhost/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: 'oldpass12', newPassword: 'newpass12' }),
    });
    const response = await updatePassword(request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toContain('ユーザー情報の取得に失敗しました');
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 200 and update password when valid', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'user-123', password_hash: 'hashed-old' },
      error: null,
    });
    mockCompare.mockResolvedValueOnce(true);
    mockUpdateUser.mockResolvedValueOnce({ data: {}, error: null });
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnValue({ eq: mockEq }),
      });

    const request = new Request('http://localhost/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: 'oldpass12', newPassword: 'newpass12' }),
    });
    const response = await updatePassword(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.message).toContain('パスワードを変更しました');
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass12' });
  });
});
