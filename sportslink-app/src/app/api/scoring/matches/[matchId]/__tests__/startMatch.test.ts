import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startMatch } from '../start/startMatch';

const mockUpdate = vi.fn();
const mockEq = vi.fn();
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
  isUmpire: vi.fn().mockResolvedValue(true),
  isTournamentAdmin: vi.fn().mockResolvedValue(false),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

describe('startMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockSingle }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: mockSingle }),
            }),
          }),
        };
      }
      return {};
    });
  });

  it('should start match successfully', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'inprogress',
      started_at: new Date().toISOString(),
    };
    mockSingle
      .mockResolvedValueOnce({ data: { tournament_id: 'tournament-123' }, error: null })
      .mockResolvedValueOnce({ data: mockMatch, error: null });

    const response = await startMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('inprogress');
    expect(data.started_at).toBeDefined();
  });

  it('should return 500 on database error', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { tournament_id: 'tournament-123' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });

    const response = await startMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await startMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の開始に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

