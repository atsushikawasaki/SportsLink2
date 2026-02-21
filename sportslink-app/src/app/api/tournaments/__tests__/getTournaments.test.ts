import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTournaments } from '../getTournaments';

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

describe('getTournaments', () => {
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

  it('should get tournaments with default pagination', async () => {
    const mockTournaments = [
      { id: 'tournament-1', name: 'Tournament 1' },
      { id: 'tournament-2', name: 'Tournament 2' },
    ];

    mockRange.mockResolvedValue({
      data: mockTournaments,
      error: null,
      count: 2,
    });

    const request = new Request('http://localhost/api/tournaments');

    const response = await getTournaments(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockTournaments);
    expect(data.count).toBe(2);
    expect(data.limit).toBe(10);
    expect(data.offset).toBe(0);
  });

  it('should get tournaments with custom pagination', async () => {
    const mockTournaments = [
      { id: 'tournament-1', name: 'Tournament 1' },
    ];

    mockRange.mockResolvedValue({
      data: mockTournaments,
      error: null,
      count: 1,
    });

    const request = new Request('http://localhost/api/tournaments?limit=5&offset=10');

    const response = await getTournaments(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.limit).toBe(5);
    expect(data.offset).toBe(10);
  });

  it('should filter tournaments by status', async () => {
    const mockTournaments = [
      { id: 'tournament-1', name: 'Tournament 1', status: 'published' },
    ];

    mockEq.mockResolvedValue({
      data: mockTournaments,
      error: null,
      count: 1,
    });

    const request = new Request('http://localhost/api/tournaments?status=published');

    const response = await getTournaments(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith('status', 'published');
  });

  it('should handle empty results', async () => {
    mockRange.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });

    const request = new Request('http://localhost/api/tournaments');

    const response = await getTournaments(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
    expect(data.count).toBe(0);
  });

  it('should return 500 on database error', async () => {
    mockRange.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
      count: null,
    });

    const request = new Request('http://localhost/api/tournaments');

    const response = await getTournaments(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/tournaments');

    const response = await getTournaments(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('大会一覧の取得に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });

  it('should handle invalid limit parameter', async () => {
    const mockTournaments: { id: string; name?: string }[] = [];

    mockRange.mockResolvedValue({
      data: mockTournaments,
      error: null,
      count: 0,
    });

    const request = new Request('http://localhost/api/tournaments?limit=invalid');

    const response = await getTournaments(request);
    const data = await response.json();

    // Invalid limit falls back to default 10
    expect(response.status).toBe(200);
    expect(data.limit).toBe(10);
  });

  it('should handle invalid offset parameter', async () => {
    const mockTournaments: { id: string; name?: string }[] = [];

    mockRange.mockResolvedValue({
      data: mockTournaments,
      error: null,
      count: 0,
    });

    const request = new Request('http://localhost/api/tournaments?offset=invalid');

    const response = await getTournaments(request);
    const data = await response.json();

    // Invalid offset falls back to default 0
    expect(response.status).toBe(200);
    expect(data.offset).toBe(0);
  });
});

