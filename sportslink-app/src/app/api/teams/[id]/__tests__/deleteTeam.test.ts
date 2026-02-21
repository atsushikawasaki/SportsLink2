import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteTeam } from '../deleteTeam';

const mockFrom = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-123' } },
  error: null,
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/permissions', () => ({
  isTeamAdmin: vi.fn().mockResolvedValue(true),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

describe('deleteTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const deleteChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue({ delete: mockDelete });
    mockDelete.mockReturnValue(deleteChain);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await deleteTeam('team-123');
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 403 when user has no permission', async () => {
    const { isTeamAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isTeamAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);

    const response = await deleteTeam('team-123');
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('このチームを削除する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should delete team and return 200', async () => {
    const response = await deleteTeam('team-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('チームを削除しました');
    expect(mockFrom).toHaveBeenCalledWith('teams');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    const deleteChain = { eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }) };
    mockDelete.mockReturnValueOnce(deleteChain);

    const response = await deleteTeam('team-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await deleteTeam('team-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('チームの削除に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});
