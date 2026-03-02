import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTeams } from '../getTeams';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('getTeams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return teams list with count when no tournament_id', async () => {
    const mockRange = vi.fn().mockResolvedValue({
      data: [{ id: 'team-1', name: 'Team A' }],
      error: null,
      count: 1,
    });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ order: mockOrder }),
    });

    const request = new Request('http://localhost/api/teams');
    const response = await getTeams(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].name).toBe('Team A');
    expect(data.count).toBe(1);
  });

  it('should filter by tournament_id when provided', async () => {
    const mockEq = vi.fn().mockReturnValue({
      not: vi.fn().mockResolvedValue({ data: [{ team_id: 'team-1' }], error: null }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ not: mockEq }) }),
    });

    vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [{ id: 'team-1', name: 'Team A' }],
          error: null,
          count: 1,
        }),
      }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ range: vi.fn() }) }),
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: [{ id: 'team-1', name: 'Team A' }],
            error: null,
            count: 1,
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/teams?tournament_id=tournament-123');
    const response = await getTeams(request);
    await response.json();

    expect(response.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith('tournament_entries');
    expect(mockFrom).toHaveBeenCalledWith('teams');
  });

  it('should return empty array and 0 count when tournament has no entries', async () => {
    const notResolved = Promise.resolve({ data: [], error: null });
    const chainAfterEq = { not: () => notResolved };
    const chainAfterSelect = { eq: () => chainAfterEq };
    const tournamentEntriesChain = { select: () => chainAfterSelect };
    const teamsChain = {
      select: () => ({
        order: () => ({ range: () => Promise.resolve({ data: [], error: null, count: 0 }) }),
      }),
    };
    mockFrom.mockReset();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournament_entries') return tournamentEntriesChain;
      if (table === 'teams') return teamsChain;
      return undefined;
    });

    const request = new Request('http://localhost/api/teams?tournament_id=tournament-empty');
    const response = await getTeams(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
    expect(data.count).toBe(0);
  });

  it('should return 500 on database error', async () => {
    const mockRange = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
      count: null,
    });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ order: mockOrder }),
    });

    const request = new Request('http://localhost/api/teams');
    const response = await getTeams(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(['E-DB-001', 'E-SERVER-001']).toContain(data.code);
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/teams');
    const response = await getTeams(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('E-SERVER-001');
    expect(data.error).toBeDefined();
  });
});
