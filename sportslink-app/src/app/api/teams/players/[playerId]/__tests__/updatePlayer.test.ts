import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePlayer } from '../updatePlayer';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
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
  isAdmin: vi.fn().mockResolvedValue(false),
}));

describe('updatePlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const selectChain = { eq: vi.fn().mockReturnValue({ single: mockSingle }) };
    const updateChain = { eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) }) };
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournament_players') {
        return { select: mockSelect, eq: mockEq, update: mockUpdate };
      }
      return {};
    });
    mockSelect.mockReturnValue(selectChain);
    mockUpdate.mockReturnValue(updateChain);
  });

  it('should return 400 when body is invalid', async () => {
    const request = new Request('http://localhost/api/teams/players/player-123', {
      method: 'PUT',
      body: JSON.stringify({ player_type: 'invalid' }),
    });

    const response = await updatePlayer('player-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when no fields to update', async () => {
    const request = new Request('http://localhost/api/teams/players/player-123', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await updatePlayer('player-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('更新する項目がありません');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const request = new Request('http://localhost/api/teams/players/player-123', {
      method: 'PUT',
      body: JSON.stringify({ player_name: 'New Name' }),
    });

    const response = await updatePlayer('player-123', request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 404 when player not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const request = new Request('http://localhost/api/teams/players/player-123', {
      method: 'PUT',
      body: JSON.stringify({ player_name: 'New Name' }),
    });

    const response = await updatePlayer('player-123', request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('選手が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 403 when user has no permission', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { actual_team_id: 'team-123' },
      error: null,
    });
    const { isTeamAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isTeamAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);

    const request = new Request('http://localhost/api/teams/players/player-123', {
      method: 'PUT',
      body: JSON.stringify({ player_name: 'New Name' }),
    });

    const response = await updatePlayer('player-123', request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('この選手を更新する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should update player and return 200', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { actual_team_id: 'team-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: { id: 'player-123', player_name: 'Updated Name', player_type: '前衛' },
      error: null,
    });

    const request = new Request('http://localhost/api/teams/players/player-123', {
      method: 'PUT',
      body: JSON.stringify({ player_name: 'Updated Name' }),
    });

    const response = await updatePlayer('player-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.player_name).toBe('Updated Name');
    expect(mockUpdate).toHaveBeenCalledWith({ player_name: 'Updated Name' });
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/teams/players/player-123', {
      method: 'PUT',
      body: JSON.stringify({ player_name: 'New Name' }),
    });

    const response = await updatePlayer('player-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('選手の更新に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});
