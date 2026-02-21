import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMatch } from '../createMatch';

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
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
  isTournamentAdmin: vi.fn().mockResolvedValue(true),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

describe('createMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockInsertChain = {
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'match_scores') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn().mockReturnValue(mockInsertChain),
      };
    });
  });

  it('should return 400 when tournament_id is missing', async () => {
    const request = new Request('http://localhost/api/matches', {
      method: 'POST',
      body: JSON.stringify({
        round_name: 'Round 1',
      }),
    });

    const response = await createMatch(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('大会IDとラウンド名は必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when round_name is missing', async () => {
    const request = new Request('http://localhost/api/matches', {
      method: 'POST',
      body: JSON.stringify({
        tournament_id: 'tournament-123',
      }),
    });

    const response = await createMatch(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('大会IDとラウンド名は必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should create match with required fields', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      round_name: 'Round 1',
      umpire_id: null,
      court_number: null,
      phase_id: null,
      status: 'pending',
      version: 1,
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches', {
      method: 'POST',
      body: JSON.stringify({
        tournament_id: 'tournament-123',
        round_name: 'Round 1',
      }),
    });

    const response = await createMatch(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('match-123');
    expect(data.tournament_id).toBe('tournament-123');
    expect(data.round_name).toBe('Round 1');
    expect(data.status).toBe('pending');
    expect(data.version).toBe(1);
  });

  it('should create match with all fields', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      round_name: 'Round 1',
      umpire_id: 'umpire-456',
      court_number: 1,
      phase_id: 'phase-789',
      status: 'pending',
      version: 1,
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches', {
      method: 'POST',
      body: JSON.stringify({
        tournament_id: 'tournament-123',
        round_name: 'Round 1',
        umpire_id: 'umpire-456',
        court_number: 1,
        phase_id: 'phase-789',
      }),
    });

    const response = await createMatch(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.umpire_id).toBe('umpire-456');
    expect(data.court_number).toBe(1);
    expect(data.phase_id).toBe('phase-789');
  });

  it('should create initial match_scores record', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      round_name: 'Round 1',
      status: 'pending',
      version: 1,
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const mockInsertScore = vi.fn().mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'match_scores') {
        return {
          insert: mockInsertScore,
        };
      }
      const mockInsertChain = {
        select: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      };
      return {
        insert: vi.fn().mockReturnValue(mockInsertChain),
      };
    });

    const request = new Request('http://localhost/api/matches', {
      method: 'POST',
      body: JSON.stringify({
        tournament_id: 'tournament-123',
        round_name: 'Round 1',
      }),
    });

    await createMatch(request);

    expect(mockFrom).toHaveBeenCalledWith('match_scores');
    expect(mockInsertScore).toHaveBeenCalledWith({
      match_id: 'match-123',
      game_count_a: 0,
      game_count_b: 0,
    });
  });

  it('should return 500 on database error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database constraint violation' },
    });

    const request = new Request('http://localhost/api/matches', {
      method: 'POST',
      body: JSON.stringify({
        tournament_id: 'tournament-123',
        round_name: 'Round 1',
      }),
    });

    const response = await createMatch(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/matches', {
      method: 'POST',
      body: JSON.stringify({
        tournament_id: 'tournament-123',
        round_name: 'Round 1',
      }),
    });

    const response = await createMatch(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の作成に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

