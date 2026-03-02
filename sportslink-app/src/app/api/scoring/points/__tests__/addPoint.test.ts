import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addPoint } from '../addPoint';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockUpsert = vi.fn();
const mockPointsSelect = vi.fn();
const mockPointsEq = vi.fn();
const mockUpdateSingle = vi.fn();

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

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'uuid-123'),
}));

describe('addPoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockQueryChain = {
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    };

    const mockInsertChain = {
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    };

    mockPointsSelect.mockReturnValue({ eq: mockPointsEq });
    mockPointsEq.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ point_type: 'A_score' as const }],
        error: null,
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'points') {
        return {
          select: mockPointsSelect,
          insert: vi.fn().mockReturnValue(mockInsertChain),
        };
      }
      if (table === 'match_scores') {
        return {
          upsert: mockUpsert.mockReturnValue(Promise.resolve({ data: null, error: null })),
        };
      }
      return {
        select: mockSelect,
        insert: vi.fn().mockReturnValue(mockInsertChain),
        update: mockUpdate,
      };
    });

    mockSelect.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
    mockUpdateSingle.mockResolvedValue({ data: { version: 6 }, error: null });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: mockUpdateSingle,
          }),
        }),
      }),
    });
  });

  it('should return 400 when match_id is missing', async () => {
    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        point_type: 'A_score',
        client_uuid: 'client-123',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('必須パラメータが不足しています');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when point_type is missing', async () => {
    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
        client_uuid: 'client-123',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('必須パラメータが不足しています');
  });

  it('should return 400 when client_uuid is missing', async () => {
    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
        point_type: 'A_score',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('必須パラメータが不足しています');
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'nonexistent-match',
        point_type: 'A_score',
        client_uuid: 'client-123',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 409 when version conflict occurs in request', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'match-123',
        version: 5,
        status: 'inprogress',
      },
      error: null,
    });

    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
        point_type: 'A_score',
        client_uuid: 'client-123',
        matchVersion: 4, // Different from server version
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('データが競合しています');
    expect(data.code).toBe('E-CONFL-001');
  });

  it('should return 409 when version conflict on update (optimistic lock)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'match-123',
        version: 5,
        status: 'inprogress',
        tournament_id: 'tournament-123',
      },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'uuid-123',
        match_id: 'match-123',
        point_type: 'A_score',
        client_uuid: 'client-123',
        is_undone: false,
      },
      error: null,
    });
    mockUpdateSingle.mockResolvedValueOnce({ data: null, error: { message: 'No rows' } });

    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
        point_type: 'A_score',
        client_uuid: 'client-123',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('データが競合しています');
    expect(data.code).toBe('E-CONFL-001');
  });

  it('should return 400 when match status is not inprogress', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'match-123',
        version: 5,
        status: 'finished',
      },
      error: null,
    });

    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
        point_type: 'A_score',
        client_uuid: 'client-123',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('進行中の試合のみポイントを追加できます');
  });

  it('should add point successfully', async () => {
    const mockMatch = {
      id: 'match-123',
      version: 5,
      status: 'inprogress',
    };

    const mockPoint = {
      id: 'uuid-123',
      match_id: 'match-123',
      point_type: 'A_score',
      client_uuid: 'client-123',
      is_undone: false,
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: mockPoint,
      error: null,
    });

    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
        point_type: 'A_score',
        client_uuid: 'client-123',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.point).toEqual(mockPoint);
    expect(data.newVersion).toBe(6);
    expect(data.match_scores).toEqual({ game_count_a: 1, game_count_b: 0 });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        match_id: 'match-123',
        game_count_a: 1,
        game_count_b: 0,
      }),
      expect.any(Object)
    );
  });

  it('should increment match version after adding point', async () => {
    mockUpdateSingle.mockResolvedValueOnce({ data: { version: 11 }, error: null });
    mockPointsEq.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValue({
        data: [{ point_type: 'B_score' as const }],
        error: null,
      }),
    });

    const mockMatch = {
      id: 'match-123',
      version: 10,
      status: 'inprogress',
    };

    const mockPoint = {
      id: 'uuid-123',
      match_id: 'match-123',
      point_type: 'B_score',
      client_uuid: 'client-456',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: mockPoint,
      error: null,
    });

    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
        point_type: 'B_score',
        client_uuid: 'client-456',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.newVersion).toBe(11);
    expect(data.match_scores).toEqual({ game_count_a: 0, game_count_b: 1 });
  });

  it('should return 500 on database error when inserting point', async () => {
    const mockMatch = {
      id: 'match-123',
      version: 5,
      status: 'inprogress',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
        point_type: 'A_score',
        client_uuid: 'client-123',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/scoring/points', {
      method: 'POST',
      body: JSON.stringify({
        match_id: 'match-123',
        point_type: 'A_score',
        client_uuid: 'client-123',
      }),
    });

    const response = await addPoint(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('ポイントの追加に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });

  it('should handle different point types', async () => {
    const mockMatch = {
      id: 'match-123',
      version: 5,
      status: 'inprogress',
    };

    const pointTypes = ['A_score', 'B_score'] as const;

    for (const pointType of pointTypes) {
      mockPointsEq.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({
          data: [{ point_type: pointType }],
          error: null,
        }),
      });

      const mockPoint = {
        id: 'uuid-123',
        match_id: 'match-123',
        point_type: pointType,
        client_uuid: 'client-123',
      };

      mockSingle.mockResolvedValueOnce({
        data: mockMatch,
        error: null,
      });

      mockSingle.mockResolvedValueOnce({
        data: mockPoint,
        error: null,
      });

      const request = new Request('http://localhost/api/scoring/points', {
        method: 'POST',
        body: JSON.stringify({
          match_id: 'match-123',
          point_type: pointType,
          client_uuid: 'client-123',
        }),
      });

      const response = await addPoint(request);
      expect(response.status).toBe(201);
    }
  });
});

