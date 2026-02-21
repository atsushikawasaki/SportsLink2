import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateTeam } from '../updateTeam';

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

describe('updateTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const updateChain = { eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) }) };
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      eq: mockEq,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockUpdate.mockReturnValue(updateChain);
  });

  it('should return 400 when body is invalid', async () => {
    const request = new Request('http://localhost/api/teams/team-123', {
      method: 'PUT',
      body: JSON.stringify({ name: 123 }),
    });

    const response = await updateTeam('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when no fields to update', async () => {
    const request = new Request('http://localhost/api/teams/team-123', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await updateTeam('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('更新する項目がありません');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const request = new Request('http://localhost/api/teams/team-123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await updateTeam('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 403 when user has no permission', async () => {
    const { isTeamAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isTeamAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);

    const request = new Request('http://localhost/api/teams/team-123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await updateTeam('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('このチームを更新する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should update team and return 200', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'team-123', name: 'Updated Team', team_manager_user_id: 'user-456' },
      error: null,
    });

    const request = new Request('http://localhost/api/teams/team-123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Team' }),
    });

    const response = await updateTeam('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('Updated Team');
    expect(mockUpdate).toHaveBeenCalledWith({ name: 'Updated Team' });
  });

  it('should return 500 on database error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new Request('http://localhost/api/teams/team-123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await updateTeam('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/teams/team-123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await updateTeam('team-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('チームの更新に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});
