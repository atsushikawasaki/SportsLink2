import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addPoint } from '../addPoint';

// モック
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
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
    
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: vi.fn().mockReturnValue(mockInsertChain),
      update: mockUpdate,
    });
    
    mockSelect.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
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

  it('should return 409 when version conflict occurs', async () => {
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

    // 3rd call: match_scores fetch
    mockSingle.mockResolvedValueOnce({
      data: { game_count_a: 0, game_count_b: 0 },
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
  });

  it('should increment match version after adding point', async () => {
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

    mockSingle.mockResolvedValueOnce({
      data: { game_count_a: 0, game_count_b: 0 },
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

    const pointTypes = ['A_score', 'B_score'];

    for (const pointType of pointTypes) {
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

      mockSingle.mockResolvedValueOnce({
        data: { game_count_a: 0, game_count_b: 0 },
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

