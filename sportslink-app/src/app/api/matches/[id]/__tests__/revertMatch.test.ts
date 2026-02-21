import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revertMatch } from '../revert/revertMatch';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
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

describe('revertMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockQueryChain = {
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    };
    
    const mockUpdateChain = {
      eq: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    };
    
    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
    }));
    
    mockSelect.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
    mockUpdate.mockReturnValue(mockUpdateChain);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await revertMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 403 when user has no permission to revert match', async () => {
    const { isUmpire, isTournamentAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isUmpire).mockResolvedValueOnce(false);
    vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);

    const mockMatch = {
      id: 'match-123',
      status: 'finished',
      tournament_id: 'tournament-123',
      next_match_id: null,
      winner_source_match_a: null,
      winner_source_match_b: null,
    };
    mockSingle.mockResolvedValueOnce({ data: mockMatch, error: null });

    const response = await revertMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('この試合を差し戻す権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should revert finished match to inprogress', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'finished',
      tournament_id: 'tournament-123',
      next_match_id: null,
      winner_source_match_a: null,
      winner_source_match_b: null,
    };

    const mockRevertedMatch = {
      id: 'match-123',
      status: 'inprogress',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: mockRevertedMatch,
      error: null,
    });

    const response = await revertMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('inprogress');
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const response = await revertMatch('nonexistent-match');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 400 when match is not finished', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'inprogress',
      tournament_id: 'tournament-123',
      next_match_id: null,
      winner_source_match_a: null,
      winner_source_match_b: null,
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const response = await revertMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('終了した試合のみ差し戻しできます');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when match status is paused', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'paused',
      tournament_id: 'tournament-123',
      next_match_id: null,
      winner_source_match_a: null,
      winner_source_match_b: null,
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const response = await revertMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('終了した試合のみ差し戻しできます');
  });

  it('should return 500 on database error when updating', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'finished',
      tournament_id: 'tournament-123',
      next_match_id: null,
      winner_source_match_a: null,
      winner_source_match_b: null,
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const response = await revertMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await revertMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の差し戻しに失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

