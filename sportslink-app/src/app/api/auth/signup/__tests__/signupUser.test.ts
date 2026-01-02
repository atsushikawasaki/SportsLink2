import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signupUser } from '../signupUser';

// モック
const mockSignUp = vi.fn();
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signUp: mockSignUp,
    },
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password: string) => Promise.resolve(`hashed-${password}`)),
  },
}));

vi.mock('@/lib/consent-versions', () => ({
  getConsentVersions: vi.fn(() => ({
    terms: '1.0.0',
    privacy: '1.0.0',
  })),
}));

describe('signupUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockQueryChain = {
      eq: mockEq,
      single: mockSingle,
    };
    
    const mockInsertChain = {
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    };
    
    const mockUpdateChain = {
      eq: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    };
    
    const mockInsertConsentChain = {
      data: null,
      error: null,
    };
    
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_consents') {
        return {
          insert: vi.fn().mockResolvedValue(mockInsertConsentChain),
        };
      }
      return {
        select: mockSelect,
        insert: vi.fn().mockReturnValue(mockInsertChain),
        update: vi.fn().mockReturnValue(mockUpdateChain),
      };
    });
    
    mockSelect.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
  });

  it('should return 400 when email is missing', async () => {
    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        password: 'password123',
        displayName: 'Test User',
        agreeTerms: true,
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('必須項目を入力してください');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when password is missing', async () => {
    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        displayName: 'Test User',
        agreeTerms: true,
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('必須項目を入力してください');
  });

  it('should return 400 when displayName is missing', async () => {
    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        agreeTerms: true,
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('必須項目を入力してください');
  });

  it('should return 400 when agreeTerms is false', async () => {
    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        agreeTerms: false,
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('利用規約とプライバシーポリシーに同意してください');
  });

  it('should return 400 when agreeTerms is missing', async () => {
    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('利用規約とプライバシーポリシーに同意してください');
  });

  it('should return 400 when auth signup fails', async () => {
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: 'User already exists' },
    });

    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        agreeTerms: true,
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('User already exists');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 500 when user creation fails', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        agreeTerms: true,
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('ユーザー作成に失敗しました');
    expect(data.code).toBe('E-AUTH-003');
  });

  it('should create user successfully with trigger', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    };

    mockSignUp.mockResolvedValue({
      data: {
        user: mockUser,
        session: null,
      },
      error: null,
    });

    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'Test User',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockProfile,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: mockProfile,
      error: null,
    });

    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Test Agent',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        agreeTerms: true,
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.message).toContain('アカウントが作成されました');
  });

  it('should create user with fallback when trigger fails', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    mockSignUp.mockResolvedValue({
      data: {
        user: mockUser,
        session: null,
      },
      error: null,
    });

    // Trigger fails
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    // Fallback profile creation
    const mockFallbackProfile = {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'Test User',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockFallbackProfile,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: mockFallbackProfile,
      error: null,
    });

    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Test Agent',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        agreeTerms: true,
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
  });

  it('should return 500 on server error', async () => {
    mockSignUp.mockRejectedValue(new Error('Server error'));

    const request = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        agreeTerms: true,
      }),
    });

    const response = await signupUser(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('サインアップに失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

