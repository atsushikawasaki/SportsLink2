import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMatchScore } from '../updateMatchScore';

const mockFrom = vi.fn();
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
  isUmpire: vi.fn().mockResolvedValue(true),
  isTournamentAdmin: vi.fn().mockResolvedValue(false),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

describe('updateMatchScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const request = new Request('http://localhost/api/score', {
      method: 'PUT',
      body: JSON.stringify({ game_count_a: 1, game_count_b: 0 }),
    });
    const response = await updateMatchScore('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 403 when user has no permission', async () => {
    const { isUmpire, isTournamentAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isUmpire).mockResolvedValueOnce(false);
    vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    const selectSingle = vi.fn().mockResolvedValue({
      data: { id: 'match-123', status: 'inprogress', tournament_id: 'tournament-123' },
      error: null,
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: selectSingle }) }),
    });

    const request = new Request('http://localhost/api/score', {
      method: 'PUT',
      body: JSON.stringify({ game_count_a: 1, game_count_b: 0 }),
    });
    const response = await updateMatchScore('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.error).toContain('この試合のスコアを変更する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 400 when game_count is invalid', async () => {
    const request = new Request('http://localhost/api/score', {
      method: 'PUT',
      body: JSON.stringify({ game_count_a: -1, game_count_b: 0 }),
    });
    const response = await updateMatchScore('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('0 以上の数値');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 404 when match not found', async () => {
    const selectSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: selectSingle }) }),
    });

    const request = new Request('http://localhost/api/score', {
      method: 'PUT',
      body: JSON.stringify({ game_count_a: 1, game_count_b: 0 }),
    });
    const response = await updateMatchScore('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 400 when match is already finished', async () => {
    const selectSingle = vi.fn().mockResolvedValue({
      data: { id: 'match-123', status: 'finished', tournament_id: 'tournament-123' },
      error: null,
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: selectSingle }) }),
    });

    const request = new Request('http://localhost/api/score', {
      method: 'PUT',
      body: JSON.stringify({ game_count_a: 1, game_count_b: 0 }),
    });
    const response = await updateMatchScore('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('終了済みの試合のスコアは直接変更できません');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });
    const request = new Request('http://localhost/api/score', {
      method: 'PUT',
      body: JSON.stringify({ game_count_a: 1, game_count_b: 0 }),
    });
    const response = await updateMatchScore('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toContain('スコアの更新に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

