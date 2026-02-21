import { describe, it, expect, vi, beforeEach } from 'vitest';
import { undoPoint } from '../undoPoint';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockUpsert = vi.fn();
const mockPointsEq = vi.fn();
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

describe('undoPoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockQueryChain = {
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      single: mockSingle,
    };

    mockPointsEq.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockSelect.mockImplementation((cols?: string) => {
      if (cols === 'point_type') return { eq: mockPointsEq };
      return mockQueryChain;
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'points') {
        return { select: mockSelect, update: mockUpdate };
      }
      if (table === 'match_scores') {
        return {
          upsert: mockUpsert.mockReturnValue(Promise.resolve({ data: null, error: null })),
        };
      }
      return { select: mockSelect, update: mockUpdate };
    });

    mockEq.mockReturnValue(mockQueryChain);
    mockOrder.mockReturnValue(mockQueryChain);
    mockLimit.mockReturnValue(mockQueryChain);
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('should return 400 when match_id is missing', async () => {
    const request = new Request('http://localhost/api/scoring/undo', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await undoPoint(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('試合IDは必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const request = new Request('http://localhost/api/scoring/undo', {
      method: 'POST',
      body: JSON.stringify({ match_id: 'match-123' }),
    });
    const response = await undoPoint(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 403 when user has no permission to undo', async () => {
    const { isUmpire, isTournamentAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isUmpire).mockResolvedValueOnce(false);
    vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    mockSingle.mockResolvedValueOnce({
      data: { id: 'match-123', tournament_id: 'tournament-123' },
      error: null,
    });

    const request = new Request('http://localhost/api/scoring/undo', {
      method: 'POST',
      body: JSON.stringify({ match_id: 'match-123' }),
    });
    const response = await undoPoint(request);
    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.error).toContain('この試合のポイントを取り消す権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 400 when no points to undo', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'match-123', tournament_id: 'tournament-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new Request('http://localhost/api/scoring/undo', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
      }),
    });

    const response = await undoPoint(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('取り消すポイントがありません');
    expect(data.code).toBe('E-VER-003');
  });

  it('should undo the latest point', async () => {
    const mockPoint = {
      id: 'point-123',
      match_id: 'match-123',
      point_type: 'A_score',
      is_undone: false,
      server_received_at: '2024-01-01T00:00:00Z',
    };

    const mockMatch = {
      id: 'match-123',
      version: 5,
    };

    mockSingle.mockResolvedValueOnce({
      data: { id: 'match-123', tournament_id: 'tournament-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: mockPoint,
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const mockUpdateChain = {
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const mockVersionUpdate = {
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: mockSelect,
          update: vi.fn().mockReturnValue(mockVersionUpdate),
        };
      }
      if (table === 'points') {
        return { select: mockSelect, update: vi.fn().mockReturnValue(mockUpdateChain) };
      }
      if (table === 'match_scores') {
        return {
          upsert: mockUpsert.mockReturnValue(Promise.resolve({ data: null, error: null })),
        };
      }
      return {
        select: mockSelect,
        update: vi.fn().mockReturnValue(mockUpdateChain),
      };
    });

    const request = new Request('http://localhost/api/scoring/undo', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
      }),
    });

    const response = await undoPoint(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('ポイントを取り消しました');
    expect(data.undonePoint).toEqual(mockPoint);
    expect(data.match_scores).toEqual({ game_count_a: 0, game_count_b: 0 });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        match_id: 'match-123',
        game_count_a: 0,
        game_count_b: 0,
      }),
      expect.any(Object)
    );
  });

  it('should increment match version after undo', async () => {
    const mockPoint = {
      id: 'point-123',
      match_id: 'match-123',
      point_type: 'A_score',
      is_undone: false,
    };

    const mockMatch = {
      id: 'match-123',
      version: 5,
    };

    mockSingle.mockResolvedValueOnce({
      data: { id: 'match-123', tournament_id: 'tournament-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: mockPoint,
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const mockVersionUpdate = {
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: mockSelect,
          update: vi.fn().mockReturnValue(mockVersionUpdate),
        };
      }
      if (table === 'points') {
        return { select: mockSelect, update: mockUpdate };
      }
      if (table === 'match_scores') {
        return {
          upsert: mockUpsert.mockReturnValue(Promise.resolve({ data: null, error: null })),
        };
      }
      return { select: mockSelect, update: mockUpdate };
    });

    const request = new Request('http://localhost/api/scoring/undo', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
      }),
    });

    await undoPoint(request);

    expect(mockVersionUpdate.eq).toHaveBeenCalledWith('id', 'match-123');
  });

  it('should return 500 on database error when updating point', async () => {
    const mockPoint = {
      id: 'point-123',
      match_id: 'match-123',
      point_type: 'A_score',
      is_undone: false,
    };

    mockSingle.mockResolvedValueOnce({
      data: { id: 'match-123', tournament_id: 'tournament-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: mockPoint,
      error: null,
    });

    const mockUpdateChain = {
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'match_scores') {
        return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }
      return {
        select: mockSelect,
        update: vi.fn().mockReturnValue(mockUpdateChain),
      };
    });

    const request = new Request('http://localhost/api/scoring/undo', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
      }),
    });

    const response = await undoPoint(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/scoring/undo', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
      }),
    });

    const response = await undoPoint(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Undo操作に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });

  it('should only undo non-undone points', async () => {
    const mockPoint = {
      id: 'point-123',
      match_id: 'match-123',
      point_type: 'A_score',
      is_undone: false,
    };

    const mockMatch = {
      id: 'match-123',
      version: 5,
    };

    mockSingle.mockResolvedValueOnce({
      data: { id: 'match-123', tournament_id: 'tournament-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: mockPoint,
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const mockUpdateChain = {
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const mockVersionUpdate = {
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: mockSelect,
          update: vi.fn().mockReturnValue(mockVersionUpdate),
        };
      }
      if (table === 'points') {
        return { select: mockSelect, update: vi.fn().mockReturnValue(mockUpdateChain) };
      }
      if (table === 'match_scores') {
        return {
          upsert: mockUpsert.mockReturnValue(Promise.resolve({ data: null, error: null })),
        };
      }
      return {
        select: mockSelect,
        update: vi.fn().mockReturnValue(mockUpdateChain),
      };
    });

    const request = new Request('http://localhost/api/scoring/undo', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
      }),
    });

    await undoPoint(request);

    expect(mockEq).toHaveBeenCalledWith('is_undone', false);
  });
});

