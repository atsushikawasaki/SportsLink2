import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deletePlayer } from '../deletePlayer';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockDelete = vi.fn();
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

describe('deletePlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const selectChain = { eq: vi.fn().mockReturnValue({ single: mockSingle }) };
    const deleteChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournament_players') {
        return {
          select: mockSelect,
          delete: mockDelete,
        };
      }
      return {};
    });
    mockSelect.mockReturnValue(selectChain);
    mockDelete.mockReturnValue(deleteChain);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await deletePlayer('player-456');
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 404 when player not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const response = await deletePlayer('player-456');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('選手が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 403 when user has no permission', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { actual_team_id: 'team-123' },
      error: null,
    });
    const { isTeamAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isTeamAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);

    const response = await deletePlayer('player-456');
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('この選手を削除する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should delete player and return 200', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { actual_team_id: 'team-123' },
      error: null,
    });

    const response = await deletePlayer('player-456');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('選手を削除しました');
    expect(mockFrom).toHaveBeenCalledWith('tournament_players');
  });

  it('should return 500 on delete database error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { actual_team_id: 'team-123' },
      error: null,
    });
    const deleteChain = { eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }) };
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournament_players') {
        return {
          select: mockSelect,
          delete: vi.fn().mockReturnValue(deleteChain),
        };
      }
      return {};
    });

    const response = await deletePlayer('player-456');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await deletePlayer('player-456');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('選手の削除に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});
