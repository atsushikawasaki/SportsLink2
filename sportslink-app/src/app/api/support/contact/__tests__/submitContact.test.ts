import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitContact } from '../submitContact';

// Supabaseクライアントをモック
const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

describe('submitContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockInsertChain = {
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    };
    
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue(mockInsertChain),
    });
  });

  it('should return 400 when category is missing', async () => {
    const request = new Request('http://localhost/api/support/contact', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters',
      }),
    });

    const response = await submitContact(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('必須項目を入力してください');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when email is missing', async () => {
    const request = new Request('http://localhost/api/support/contact', {
      method: 'POST',
      body: JSON.stringify({
        category: 'technical',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters',
      }),
    });

    const response = await submitContact(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('必須項目を入力してください');
  });

  it('should return 400 when message is too short', async () => {
    const request = new Request('http://localhost/api/support/contact', {
      method: 'POST',
      body: JSON.stringify({
        category: 'technical',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Short',
      }),
    });

    const response = await submitContact(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('本文は10文字以上で入力してください');
  });

  it('should return 400 when category is invalid', async () => {
    const request = new Request('http://localhost/api/support/contact', {
      method: 'POST',
      body: JSON.stringify({
        category: 'invalid_category',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters',
      }),
    });

    const response = await submitContact(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('無効な問い合わせ種別です');
  });

  it('should accept valid categories', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const mockContact = {
      id: 'contact-123',
      category: 'technical',
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters',
      status: 'pending',
    };

    mockSingle.mockResolvedValue({
      data: mockContact,
      error: null,
    });

    const categories = ['technical', 'feature', 'other'];

    for (const category of categories) {
      const request = new Request('http://localhost/api/support/contact', {
        method: 'POST',
        body: JSON.stringify({
          category,
          email: 'test@example.com',
          subject: 'Test Subject',
          message: 'This is a test message with enough characters',
        }),
      });

      const response = await submitContact(request);
      expect(response.status).toBe(200);
    }
  });

  it('should save contact request with logged in user', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
      },
      error: null,
    });

    const mockContact = {
      id: 'contact-123',
      user_id: 'user-123',
      category: 'technical',
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters',
      status: 'pending',
    };

    mockSingle.mockResolvedValue({
      data: mockContact,
      error: null,
    });

    const request = new Request('http://localhost/api/support/contact', {
      method: 'POST',
      body: JSON.stringify({
        category: 'technical',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters',
      }),
    });

    const response = await submitContact(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('お問い合わせを受け付けました');
    expect(data.id).toBe('contact-123');
  });

  it('should save contact request without logged in user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const mockContact = {
      id: 'contact-123',
      user_id: null,
      category: 'feature',
      email: 'test@example.com',
      subject: 'Test Subject',
      message: 'This is a test message with enough characters',
      status: 'pending',
    };

    mockSingle.mockResolvedValue({
      data: mockContact,
      error: null,
    });

    const request = new Request('http://localhost/api/support/contact', {
      method: 'POST',
      body: JSON.stringify({
        category: 'feature',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters',
      }),
    });

    const response = await submitContact(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('contact-123');
  });

  it('should return 500 on database error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new Request('http://localhost/api/support/contact', {
      method: 'POST',
      body: JSON.stringify({
        category: 'technical',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters',
      }),
    });

    const response = await submitContact(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('お問い合わせの保存に失敗しました');
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockGetUser.mockRejectedValue(new Error('Server error'));

    const request = new Request('http://localhost/api/support/contact', {
      method: 'POST',
      body: JSON.stringify({
        category: 'technical',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters',
      }),
    });

    const response = await submitContact(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('お問い合わせの送信に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

