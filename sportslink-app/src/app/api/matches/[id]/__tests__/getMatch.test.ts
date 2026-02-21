import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMatch } from '../getMatch';

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockResolvedValue(false),
  isTournamentAdmin: vi.fn().mockResolvedValue(false),
}));

function makeSelectEqSingle(resolveValue: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(resolveValue);
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, single };
}

function makeSelectEqOrder(resolveValue: { data: unknown[] }) {
  const thenable = {
    then: (fn: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(fn({ data: resolveValue.data, error: null })),
    catch: vi.fn(),
  };
  const order = vi.fn().mockReturnValue(thenable);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, order };
}

describe('getMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('should get match successfully', async () => {
    const chain1 = makeSelectEqSingle({
      data: { id: 'match-123', tournament_id: 'tournament-123' },
      error: null,
    });
    const chain2 = makeSelectEqSingle({
      data: { created_by_user_id: 'user-1' },
      error: null,
    });
    const chain3 = makeSelectEqSingle({
      data: {
        id: 'match-123',
        tournament_id: 'tournament-123',
        round_name: 'Round 1',
        status: 'inprogress',
        match_type: 'individual_match',
        match_scores: [],
        match_pairs: [],
        users: null,
        tournaments: null,
      },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(chain1)
      .mockReturnValueOnce(chain2)
      .mockReturnValueOnce(chain3);

    const response = await getMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('match-123');
    expect(data.match_scores).toEqual([]);
    expect(data.match_pairs).toEqual([]);
  });

  it('should return 404 when match not found', async () => {
    const chain1 = makeSelectEqSingle({
      data: null,
      error: { message: 'Not found' },
    });
    mockFrom.mockReturnValueOnce(chain1);

    const response = await getMatch('nonexistent-match');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should get umpire information when umpire_id exists', async () => {
    const mockUmpire = {
      id: 'umpire-456',
      display_name: 'Umpire Name',
      email: 'umpire@example.com',
    };
    const chain1 = makeSelectEqSingle({
      data: { id: 'match-123', tournament_id: 'tournament-123' },
      error: null,
    });
    const chain2 = makeSelectEqSingle({
      data: { created_by_user_id: 'other' },
      error: null,
    });
    const chain3 = makeSelectEqSingle({
      data: {
        id: 'match-123',
        umpire_id: 'umpire-456',
        match_type: 'individual_match',
        match_scores: [],
        match_pairs: [],
        users: mockUmpire,
        tournaments: null,
      },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(chain1)
      .mockReturnValueOnce(chain2)
      .mockReturnValueOnce(chain3);

    const response = await getMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toEqual(mockUmpire);
  });

  it('should get child matches for team_match', async () => {
    const mockChildMatches = [
      { id: 'child-1', parent_match_id: 'match-123' },
      { id: 'child-2', parent_match_id: 'match-123' },
    ];
    const chain1 = makeSelectEqSingle({
      data: { id: 'match-123', tournament_id: 'tournament-123' },
      error: null,
    });
    const chain2 = makeSelectEqSingle({
      data: { created_by_user_id: 'user-1' },
      error: null,
    });
    const chain3 = makeSelectEqSingle({
      data: {
        id: 'match-123',
        match_type: 'team_match',
        match_scores: [],
        match_pairs: [],
        users: null,
        tournaments: null,
      },
      error: null,
    });
    const chain4 = makeSelectEqOrder({ data: mockChildMatches });
    mockFrom
      .mockReturnValueOnce(chain1)
      .mockReturnValueOnce(chain2)
      .mockReturnValueOnce(chain3)
      .mockReturnValueOnce(chain4);

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
