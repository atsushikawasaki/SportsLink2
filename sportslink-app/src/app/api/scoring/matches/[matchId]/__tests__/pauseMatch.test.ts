import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pauseMatch } from '../pause/pauseMatch';

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
  isUmpire: vi.fn().mockResolvedValue(true),
  isTournamentAdmin: vi.fn().mockResolvedValue(false),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

describe('pauseMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    }));
  });

  it('should pause inprogress match successfully', async () => {
    const mockPausedMatch = {
      id: 'match-123',
      status: 'paused',
    };
    mockSingle
      .mockResolvedValueOnce({ data: { status: 'inprogress', tournament_id: 'tournament-123' }, error: null })
      .mockResolvedValueOnce({ data: mockPausedMatch, error: null });

    const response = await pauseMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('試合を中断しました');
    expect(data.match_id).toBe('match-123');
    expect(data.match.status).toBe('paused');
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const response = await pauseMatch('nonexistent-match');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 400 when match is not inprogress', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'finished',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const response = await pauseMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('進行中の試合のみ中断できます');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when match is already paused', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { status: 'paused', tournament_id: 'tournament-123' },
      error: null,
    });

    const response = await pauseMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('進行中の試合のみ中断できます');
  });

  it('should return 500 on database error when updating', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { status: 'inprogress', tournament_id: 'tournament-123' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });

    const response = await pauseMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の中断に失敗しました');
    expect(['E-DB-001', 'E-SERVER-001']).toContain(data.code);
  });

  it('should return 500 on server error', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('Server error'));

    const response = await pauseMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の中断に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

