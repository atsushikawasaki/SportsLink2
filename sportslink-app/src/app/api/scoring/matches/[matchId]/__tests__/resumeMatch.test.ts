import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resumeMatch } from '../resume/resumeMatch';

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

describe('resumeMatch', () => {
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

  it('should resume paused match successfully', async () => {
    const mockResumedMatch = {
      id: 'match-123',
      status: 'inprogress',
    };
    mockSingle
      .mockResolvedValueOnce({ data: { status: 'paused', tournament_id: 'tournament-123' }, error: null })
      .mockResolvedValueOnce({ data: mockResumedMatch, error: null });

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('試合を再開しました');
    expect(data.match_id).toBe('match-123');
    expect(data.match.status).toBe('inprogress');
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const response = await resumeMatch('nonexistent-match');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 400 when match is not paused', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { status: 'inprogress', tournament_id: 'tournament-123' },
      error: null,
    });

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('中断中の試合のみ再開できます');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when match is finished', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { status: 'finished', tournament_id: 'tournament-123' },
      error: null,
    });

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('中断中の試合のみ再開できます');
  });

  it('should return 500 on database error when updating', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { status: 'paused', tournament_id: 'tournament-123' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の再開に失敗しました');
    expect(['E-DB-001', 'E-SERVER-001']).toContain(data.code);
  });

  it('should return 500 on server error', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('Server error'));

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の再開に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

