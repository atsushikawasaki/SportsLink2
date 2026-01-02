import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMatch } from '../getMatch';

// Supabaseクライアントをモック
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('getMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockQueryChain = {
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      order: mockOrder,
    };
    
    mockFrom.mockImplementation(() => mockQueryChain);
    mockSelect.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
    mockOrder.mockReturnValue({
      data: [],
      error: null,
    });
  });

  it('should get match successfully', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      round_name: 'Round 1',
      status: 'inprogress',
      match_type: 'individual_match',
    };

    // First call: get match
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    // Second call: get match_scores (single returns null when no data)
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    // Third call: get match_pairs (order returns array)
    mockOrder.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const response = await getMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('match-123');
    expect(data.match_scores).toEqual([]);
    expect(data.match_pairs).toEqual([]);
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const response = await getMatch('nonexistent-match');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should get umpire information when umpire_id exists', async () => {
    const mockMatch = {
      id: 'match-123',
      umpire_id: 'umpire-456',
      match_type: 'individual_match',
    };

    const mockUmpire = {
      id: 'umpire-456',
      display_name: 'Umpire Name',
      email: 'umpire@example.com',
    };

    // First call: get match
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    // Second call: get match_scores
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    // Third call: get match_pairs
    mockOrder.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    // Fourth call: get umpire (users table)
    mockSingle.mockResolvedValueOnce({
      data: mockUmpire,
      error: null,
    });

    const response = await getMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toEqual(mockUmpire);
  });

  it('should get child matches for team_match', async () => {
    const mockMatch = {
      id: 'match-123',
      match_type: 'team_match',
    };

    const mockChildMatches = [
      { id: 'child-1', parent_match_id: 'match-123' },
      { id: 'child-2', parent_match_id: 'match-123' },
    ];

    // First call: get match
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    // Second call: get match_scores
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    // Third call: get match_pairs
    mockOrder.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    // Fourth call: get child matches
    mockOrder.mockResolvedValueOnce({
      data: mockChildMatches,
      error: null,
    });

    const response = await getMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.child_matches).toEqual(mockChildMatches);
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await getMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の取得に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

