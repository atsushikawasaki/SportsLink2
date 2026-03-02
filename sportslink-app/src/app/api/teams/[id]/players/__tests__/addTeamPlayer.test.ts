import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addTeamPlayer } from '../addTeamPlayer';

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
  isTeamAdmin: vi.fn().mockResolvedValue(true),
  isTournamentAdmin: vi.fn().mockResolvedValue(false),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

describe('addTeamPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  function setupSuccessChains() {
    const mockSingle = vi.fn();
    const mockEq = vi.fn();
    const mockSelect = vi.fn();
    const mockInsert = vi.fn();
    const mockUpdate = vi.fn();

    let callIndex = 0;
    mockSingle.mockImplementation(() => {
      callIndex += 1;
      if (callIndex === 1) {
        return Promise.resolve({ data: { id: 'team-123', name: 'Team' }, error: null });
      }
      if (callIndex === 2) {
        return Promise.resolve({ data: { id: 'entry-123' }, error: null });
      }
      if (callIndex === 3) {
        return Promise.resolve({ data: { id: 'player-123' }, error: null });
      }
      if (callIndex === 4) {
        return Promise.resolve({ data: { id: 'pair-123' }, error: null });
      }
      return Promise.resolve({
        data: { id: 'player-123', player_name: '山田', player_type: '両方' },
        error: null,
      });
    });

    const selectChain = { eq: vi.fn().mockReturnValue({ single: mockSingle }) };
    const insertChain = { select: vi.fn().mockReturnValue({ single: mockSingle }) };
    const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };

    mockFrom.mockImplementation((_table: string) => ({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      insert: mockInsert,
      update: mockUpdate,
    }));
    mockSelect.mockReturnValue(selectChain);
    mockEq.mockReturnValue(selectChain);
    mockInsert.mockReturnValue(insertChain);
    mockUpdate.mockReturnValue(updateChain);
  }

  it('should return 400 when player_name is missing', async () => {
    const request = new Request('http://localhost/api/teams/team-123/players', {
      method: 'POST',
      body: JSON.stringify({ player_type: '前衛', tournament_id: 'tournament-123' }),
    });

    const response = await addTeamPlayer('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('選手名・ポジション・大会ID');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when player_type is missing', async () => {
    const request = new Request('http://localhost/api/teams/team-123/players', {
      method: 'POST',
      body: JSON.stringify({ player_name: '山田', tournament_id: 'tournament-123' }),
    });

    const response = await addTeamPlayer('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when tournament_id is missing', async () => {
    const request = new Request('http://localhost/api/teams/team-123/players', {
      method: 'POST',
      body: JSON.stringify({ player_name: '山田', player_type: '前衛' }),
    });

    const response = await addTeamPlayer('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const request = new Request('http://localhost/api/teams/team-123/players', {
      method: 'POST',
      body: JSON.stringify({
        player_name: '山田',
        player_type: '前衛',
        tournament_id: 'tournament-123',
      }),
    });

    const response = await addTeamPlayer('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 403 when user has no permission', async () => {
    const { isTeamAdmin, isTournamentAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isTeamAdmin).mockResolvedValueOnce(false);
    vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);

    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'team-123', name: 'Team' }, error: null });
    const selectChain = { eq: vi.fn().mockReturnValue({ single: mockSingle }) };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      eq: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    });

    const request = new Request('http://localhost/api/teams/team-123/players', {
      method: 'POST',
      body: JSON.stringify({
        player_name: '山田',
        player_type: '前衛',
        tournament_id: 'tournament-123',
      }),
    });

    const response = await addTeamPlayer('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('このチームに選手を追加する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 404 when team not found', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const selectChain = { eq: vi.fn().mockReturnValue({ single: mockSingle }) };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      eq: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    });

    const request = new Request('http://localhost/api/teams/team-123/players', {
      method: 'POST',
      body: JSON.stringify({
        player_name: '山田',
        player_type: '前衛',
        tournament_id: 'tournament-123',
      }),
    });

    const response = await addTeamPlayer('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('チームが見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should add player and return 201', async () => {
    setupSuccessChains();

    const request = new Request('http://localhost/api/teams/team-123/players', {
      method: 'POST',
      body: JSON.stringify({
        player_name: '山田',
        player_type: '前衛',
        tournament_id: 'tournament-123',
      }),
    });

    const response = await addTeamPlayer('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.player_name).toBe('山田');
    expect(data.player_type).toBe('両方');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/teams/team-123/players', {
      method: 'POST',
      body: JSON.stringify({
        player_name: '山田',
        player_type: '前衛',
        tournament_id: 'tournament-123',
      }),
    });

    const response = await addTeamPlayer('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('選手の追加に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});
