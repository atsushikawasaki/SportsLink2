import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignRole } from '../assignRole';

// Supabaseクライアントをモック
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockResolvedValue(true),
}));

describe('assignRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-user-id' } },
      error: null,
    });
    const mockQueryChain = {
      eq: mockEq,
      is: mockIs,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    };
    const mockInsertChain = {
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    };
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: vi.fn().mockReturnValue(mockInsertChain),
    });
    mockSelect.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
    mockIs.mockReturnValue(mockQueryChain);
  });

  it('should return 400 when user_id is missing', async () => {
    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        role: 'admin',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ユーザーIDとロールは必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when role is missing', async () => {
    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ユーザーIDとロールは必須です');
  });

  it('should return 400 when role is invalid', async () => {
    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'invalid_role',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('有効なロールを指定してください');
  });

  it('should return 400 when admin role has scope', async () => {
    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'admin',
        tournament_id: 'tournament-456',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('adminロールはスコープを指定できません');
  });

  it('should return 400 when non-admin role has no scope', async () => {
    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'tournament_admin',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('tournament_adminロールはtournament_idが必須で');
  });

  it('should assign admin role without scope', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const mockPermission = {
      id: 'perm-123',
      user_id: 'user-123',
      role_type: 'admin',
      tournament_id: null,
      team_id: null,
      match_id: null,
    };

    mockSingle.mockResolvedValueOnce({
      data: mockPermission,
      error: null,
    });

    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'admin',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.role_type).toBe('admin');
  });

  it('should assign tournament_admin role with tournament scope', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const mockPermission = {
      id: 'perm-123',
      user_id: 'user-123',
      role_type: 'tournament_admin',
      tournament_id: 'tournament-456',
      team_id: null,
      match_id: null,
    };

    mockSingle.mockResolvedValueOnce({
      data: mockPermission,
      error: null,
    });

    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'tournament_admin',
        tournament_id: 'tournament-456',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.role_type).toBe('tournament_admin');
    expect(data.tournament_id).toBe('tournament-456');
  });

  it('should return 409 when permission already exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'perm-123',
        user_id: 'user-123',
        role_type: 'tournament_admin',
        tournament_id: 'tournament-456',
      },
      error: null,
    });

    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'tournament_admin',
        tournament_id: 'tournament-456',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('既に権限が付与されています');
    expect(data.code).toBe('E-CONFL-001');
  });

  it('should return 500 on database error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'tournament_admin',
        tournament_id: 'tournament-456',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/roles/assign', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'admin',
      }),
    });

    const response = await assignRole(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('権限の付与に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

