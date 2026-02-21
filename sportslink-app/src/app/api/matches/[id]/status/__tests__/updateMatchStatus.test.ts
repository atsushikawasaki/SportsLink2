import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMatchStatus } from '../updateMatchStatus';

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
  isUmpire: vi.fn().mockResolvedValue(true),
  isTournamentAdmin: vi.fn().mockResolvedValue(false),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/services/matchFlowService', () => ({
  processMatchFinish: vi.fn().mockResolvedValue(undefined),
}));

describe('updateMatchStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when status is invalid', async () => {
    const request = new Request('http://localhost/api/matches/match-123/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'invalid' }),
    });
    const response = await updateMatchStatus('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('有効なステータス');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const request = new Request('http://localhost/api/matches/match-123/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'inprogress' }),
    });
    const response = await updateMatchStatus('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 404 when match not found', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
    });
    const request = new Request('http://localhost/api/matches/match-123/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'inprogress' }),
    });
    const response = await updateMatchStatus('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 403 when user has no permission', async () => {
    const { isUmpire, isTournamentAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isUmpire).mockResolvedValueOnce(false);
    vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'match-123', status: 'pending', tournament_id: 'tournament-123' },
      error: null,
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
    });
    const request = new Request('http://localhost/api/matches/match-123/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'inprogress' }),
    });
    const response = await updateMatchStatus('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.error).toContain('この試合のステータスを変更する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 200 and update status to inprogress', async () => {
    const mockSingleMatch = vi.fn().mockResolvedValue({
      data: { id: 'match-123', status: 'pending', tournament_id: 'tournament-123' },
      error: null,
    });
    const mockSingleUpdate = vi.fn().mockResolvedValue({
      data: { id: 'match-123', status: 'inprogress', started_at: new Date().toISOString() },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingleMatch }) }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockSingleUpdate }),
          }),
        }),
      });
    const request = new Request('http://localhost/api/matches/match-123/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'inprogress' }),
    });
    const response = await updateMatchStatus('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('inprogress');
  });

  it('should return 500 on database error when updating', async () => {
    const mockSingleMatch = vi.fn().mockResolvedValue({
      data: { id: 'match-123', status: 'pending', tournament_id: 'tournament-123' },
      error: null,
    });
    const mockSingleUpdate = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingleMatch }) }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockSingleUpdate }),
          }),
        }),
      });
    const request = new Request('http://localhost/api/matches/match-123/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'inprogress' }),
    });
    const response = await updateMatchStatus('match-123', request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.code).toBe('E-DB-001');
  });
});
