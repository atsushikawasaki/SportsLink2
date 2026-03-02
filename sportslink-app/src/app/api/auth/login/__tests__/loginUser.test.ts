import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginUser } from '../loginUser';

// Supabaseクライアントをモック
const mockSignInWithPassword = vi.fn();
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockListUsers = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
    auth: {
      admin: {
        listUsers: mockListUsers,
        createUser: mockCreateUser,
        updateUserById: mockUpdateUser,
      },
    },
    rpc: mockRpc,
  })),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });
  });

  it('should return 400 when email is missing', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'password123' }),
    });

    const response = await loginUser(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('メールアドレスとパスワード');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when password is missing', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await loginUser(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('メールアドレスとパスワード');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when user not found in Supabase Auth and users table', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    const response = await loginUser(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('メールアドレスまたはパスワード');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 401 when password is invalid', async () => {
    const bcrypt = await import('bcryptjs');
    (bcrypt.default.compare as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
      },
      error: null,
    });

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'wrong-password',
      }),
    });

    const response = await loginUser(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('メールアドレスまたはパスワード');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 500 on server error', async () => {
    mockSignInWithPassword.mockRejectedValue(new Error('Database error'));

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    const response = await loginUser(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('ログインに失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });

  it('should handle successful login with Supabase Auth', async () => {
    const mockSession = {
      access_token: 'access-token-123',
      refresh_token: 'refresh-token-123',
      expires_at: Date.now() + 3600000,
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: mockUser,
        session: mockSession,
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
      },
      error: null,
    });

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    const response = await loginUser(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.session).toBeDefined();
    expect(data.session.access_token).toBe('access-token-123');
  });

  it('should trim and lowercase email', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh', expires_at: Date.now() },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: { id: 'user-123', email: 'test@example.com' },
      error: null,
    });

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: '  TEST@EXAMPLE.COM  ',
        password: 'password123',
      }),
    });

    await loginUser(request);

    expect(mockSignInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
      })
    );
  });
});

