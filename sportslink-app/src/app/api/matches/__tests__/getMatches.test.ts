import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMatches } from '../getMatches';

// Supabaseクライアントをモック
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('getMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockQueryChain = {
      select: mockSelect,
      order: mockOrder,
      range: mockRange,
      eq: mockEq,
    };
    
    mockFrom.mockReturnValue(mockQueryChain);
    mockSelect.mockReturnValue(mockQueryChain);
    mockOrder.mockReturnValue(mockQueryChain);
    mockRange.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
  });

  it('should get matches with default pagination', async () => {
    const mockMatches = [
      { id: 'match-1', tournament_id: 'tournament-123' },
      { id: 'match-2', tournament_id: 'tournament-123' },
    ];

    mockRange.mockResolvedValue({
      data: mockMatches,
      error: null,
      count: 2,
    });

    const request = new Request('http://localhost/api/matches');

    const response = await getMatches(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockMatches);
    expect(data.count).toBe(2);
    expect(data.limit).toBe(10);
    expect(data.offset).toBe(0);
  });

  it('should filter matches by tournament_id', async () => {
    const mockMatches = [
      { id: 'match-1', tournament_id: 'tournament-123' },
    ];

    mockEq.mockResolvedValue({
      data: mockMatches,
      error: null,
      count: 1,
    });

    const request = new Request('http://localhost/api/matches?tournament_id=tournament-123');

    const response = await getMatches(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 'tournament-123');
  });

  it('should filter matches by status', async () => {
    const mockMatches = [
      { id: 'match-1', status: 'inprogress' },
    ];

    mockEq.mockResolvedValue({
      data: mockMatches,
      error: null,
      count: 1,
    });

    const request = new Request('http://localhost/api/matches?status=inprogress');

    const response = await getMatches(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith('status', 'inprogress');
  });

  it('should filter matches by both tournament_id and status', async () => {
    const mockMatches = [
      { id: 'match-1', tournament_id: 'tournament-123', status: 'inprogress' },
    ];

    mockEq.mockResolvedValue({
      data: mockMatches,
      error: null,
      count: 1,
    });

    const request = new Request('http://localhost/api/matches?tournament_id=tournament-123&status=inprogress');

    const response = await getMatches(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 'tournament-123');
  });

  it('should return 500 on database error', async () => {
    mockRange.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
      count: null,
    });

    const request = new Request('http://localhost/api/matches');

    const response = await getMatches(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockRejectedValue(new Error('Server error'));

    const request = new Request('http://localhost/api/matches');

    const response = await getMatches(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合一覧の取得に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

