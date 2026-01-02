import { describe, it, expect, vi, beforeEach } from 'vitest';
import { removeRole } from '../removeRole';

// Supabaseクライアントをモック
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('removeRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockDeleteChain = {
      eq: mockEq,
      is: mockIs,
    };
    
    mockFrom.mockImplementation(() => ({
      delete: mockDelete,
    }));
    
    mockDelete.mockReturnValue(mockDeleteChain);
    mockEq.mockReturnValue(mockDeleteChain);
    mockIs.mockReturnValue(mockDeleteChain);
  });

  it('should return 400 when user_id is missing', async () => {
    const request = new Request('http://localhost/api/roles/remove?role=tournament_admin');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ユーザーIDとロールは必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when role is missing', async () => {
    const request = new Request('http://localhost/api/roles/remove?user_id=user-123');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ユーザーIDとロールは必須です');
  });

  it('should return 400 when role is invalid', async () => {
    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=invalid_role');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('有効なロールを指定してください');
  });

  it('should remove global role successfully', async () => {
    mockIs.mockResolvedValue({
      data: null,
      error: null,
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=admin');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('権限を削除しました');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(mockEq).toHaveBeenCalledWith('role_type', 'admin');
  });

  it('should remove tournament-specific role', async () => {
    mockEq.mockResolvedValue({
      data: null,
      error: null,
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=tournament_admin&tournament_id=tournament-456');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('権限を削除しました');
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 'tournament-456');
  });

  it('should remove team-specific role', async () => {
    mockEq.mockResolvedValue({
      data: null,
      error: null,
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=team_admin&team_id=team-789');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('権限を削除しました');
    expect(mockEq).toHaveBeenCalledWith('team_id', 'team-789');
  });

  it('should remove match-specific role', async () => {
    mockEq.mockResolvedValue({
      data: null,
      error: null,
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=umpire&match_id=match-101');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('権限を削除しました');
    expect(mockEq).toHaveBeenCalledWith('match_id', 'match-101');
  });

  it('should map old role names correctly', async () => {
    mockIs.mockResolvedValue({
      data: null,
      error: null,
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=scorer');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith('role_type', 'umpire');
  });

  it('should return 500 on database error', async () => {
    mockIs.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=admin');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=admin');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('権限の削除に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

