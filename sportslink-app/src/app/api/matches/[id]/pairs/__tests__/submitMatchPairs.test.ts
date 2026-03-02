import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitMatchPairs } from '../submitMatchPairs';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
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

describe('submitMatchPairs', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const { isUmpire, isTournamentAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isUmpire).mockResolvedValue(true);
    vi.mocked(isTournamentAdmin).mockResolvedValue(false);
    vi.mocked(isAdmin).mockResolvedValue(false);

    const selectChain = { eq: vi.fn().mockReturnValue({ single: mockSingle }) };
    const deleteChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
    const insertChain = { select: vi.fn().mockResolvedValue({ data: [{ id: 'pair-1' }], error: null }) };

    mockFrom.mockImplementation((_table: string) => ({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      delete: mockDelete,
      insert: mockInsert,
    }));
    mockSelect.mockReturnValue(selectChain);
    mockDelete.mockReturnValue(deleteChain);
    mockInsert.mockReturnValue(insertChain);
  });

  const validUuid = '550e8400-e29b-41d4-a716-446655440000';
  const validUuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const validUuid3 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
  const validUuid4 = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';

  it('should return 400 when pairs is missing', async () => {
    const request = new Request('http://localhost/api/matches/match-123/pairs', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await submitMatchPairs('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ペア情報');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when pairs is empty array', async () => {
    const request = new Request('http://localhost/api/matches/match-123/pairs', {
      method: 'POST',
      body: JSON.stringify({ pairs: [] }),
    });

    const response = await submitMatchPairs('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when pair has invalid UUID', async () => {
    const request = new Request('http://localhost/api/matches/match-123/pairs', {
      method: 'POST',
      body: JSON.stringify({
        pairs: [{ pair_number: 1, team_id: 'not-uuid', player_1_id: validUuid, player_2_id: validUuid2 }],
      }),
    });

    const response = await submitMatchPairs('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when pair_number is not number', async () => {
    const request = new Request('http://localhost/api/matches/match-123/pairs', {
      method: 'POST',
      body: JSON.stringify({
        pairs: [{ pair_number: '1', team_id: validUuid, player_1_id: validUuid2, player_2_id: validUuid3 }],
      }),
    });

    const response = await submitMatchPairs('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const request = new Request('http://localhost/api/matches/match-123/pairs', {
      method: 'POST',
      body: JSON.stringify({
        pairs: [{ pair_number: 1, team_id: validUuid, player_1_id: validUuid2, player_2_id: validUuid3 }],
      }),
    });

    const response = await submitMatchPairs('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 403 when user has no permission', async () => {
    const { isUmpire, isTournamentAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isUmpire).mockResolvedValueOnce(false);
    vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);

    mockSingle.mockResolvedValueOnce({ data: { tournament_id: 'tournament-123' }, error: null });

    const request = new Request('http://localhost/api/matches/match-123/pairs', {
      method: 'POST',
      body: JSON.stringify({
        pairs: [{ pair_number: 1, team_id: validUuid, player_1_id: validUuid2, player_2_id: validUuid3 }],
      }),
    });

    const response = await submitMatchPairs('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('この試合のペアを提出する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const request = new Request('http://localhost/api/matches/match-123/pairs', {
      method: 'POST',
      body: JSON.stringify({
        pairs: [{ pair_number: 1, team_id: validUuid, player_1_id: validUuid2, player_2_id: validUuid3 }],
      }),
    });

    const response = await submitMatchPairs('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should submit pairs and return 201', async () => {
    mockSingle.mockResolvedValueOnce({ data: { tournament_id: 'tournament-123' }, error: null });

    const request = new Request('http://localhost/api/matches/match-123/pairs', {
      method: 'POST',
      body: JSON.stringify({
        pairs: [
          { pair_number: 1, team_id: validUuid, player_1_id: validUuid2, player_2_id: validUuid3 },
          { pair_number: 2, team_id: validUuid, player_1_id: validUuid4 },
        ],
      }),
    });

    const response = await submitMatchPairs('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toBeDefined();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ match_id: 'match-123', pair_number: 1, team_id: validUuid, player_1_id: validUuid2, player_2_id: validUuid3 }),
        expect.objectContaining({ match_id: 'match-123', pair_number: 2, team_id: validUuid, player_1_id: validUuid4, player_2_id: null }),
      ])
    );
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/matches/match-123/pairs', {
      method: 'POST',
      body: JSON.stringify({
        pairs: [{ pair_number: 1, team_id: validUuid, player_1_id: validUuid2, player_2_id: validUuid3 }],
      }),
    });

    const response = await submitMatchPairs('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('ペアの提出に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});
