import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkinEntry } from '../checkinEntry';

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
  isTeamAdmin: vi.fn().mockResolvedValue(false),
}));

describe('checkinEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const response = await checkinEntry('tournament-123', 'entry-123');
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 404 when entry not found', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
      }),
    });

    const response = await checkinEntry('tournament-123', 'entry-123');
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toContain('エントリーが見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 403 when user has no permission', async () => {
    const { isTournamentAdmin, isTeamAdmin } = await import('@/lib/permissions');
    vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
    vi.mocked(isTeamAdmin).mockResolvedValueOnce(false);
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'entry-123', tournament_id: 'tournament-123', team_id: 'team-456' },
      error: null,
    });
    const mockTeamSingle = vi.fn().mockResolvedValue({
      data: { team_manager_user_id: 'other-user' },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockTeamSingle }) }),
      });

    const response = await checkinEntry('tournament-123', 'entry-123');
    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.error).toContain('このエントリーをチェックインする権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 500 on database error when updating', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'entry-123', tournament_id: 'tournament-123', team_id: null },
      error: null,
    });
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      }),
    });
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ neq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) }),
          }),
        }),
      })
      .mockReturnValueOnce({
        update: mockUpdate,
      });

    const response = await checkinEntry('tournament-123', 'entry-123');
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(['E-DB-001', 'E-SERVER-001']).toContain(data.code);
  });
});
