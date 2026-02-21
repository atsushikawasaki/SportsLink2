import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishTournament } from '../publish/publishTournament';

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

function makeSelectEqSingleChain(resolveValue: { data: unknown; error: unknown }) {
  const mockSingle = vi.fn().mockResolvedValue(resolveValue);
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
  return { select: vi.fn().mockReturnValue({ eq: mockEq }), mockEq, mockSingle };
}

function makeSelectCountChain(count: number, error: unknown = null) {
  const innerEq = vi.fn().mockResolvedValue({ count, error });
  const outerEq = vi.fn().mockReturnValue({ eq: innerEq });
  return { select: vi.fn().mockReturnValue({ eq: outerEq }) };
}

function makeUpdateEqSelectSingleChain(resolveValue: { data: unknown; error: unknown }) {
  const mockSingle = vi.fn().mockResolvedValue(resolveValue);
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  return { update: mockUpdate, mockEq, mockUpdate, mockSingle };
}

describe('publishTournament', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const response = await publishTournament('tournament-123');
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 403 when user has no permission to publish', async () => {
    const { isTournamentAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    const chain1 = makeSelectEqSingleChain({
      data: { id: 'tournament-123', status: 'draft', created_by_user_id: 'other-user' },
      error: null,
    });
    mockFrom.mockReturnValueOnce(chain1);
    const response = await publishTournament('tournament-123');
    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.error).toContain('この大会を公開する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should publish tournament successfully', async () => {
    const chain1 = makeSelectEqSingleChain({
      data: { id: 'tournament-123', status: 'draft', created_by_user_id: 'user-123' },
      error: null,
    });
    const chain2 = makeSelectCountChain(1, null);
    const chain3 = makeUpdateEqSelectSingleChain({
      data: { id: 'tournament-123', name: 'Test', status: 'published', is_public: true },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(chain1)
      .mockReturnValueOnce(chain2)
      .mockReturnValueOnce(chain3);

    const response = await publishTournament('tournament-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('published');
    expect(data.is_public).toBe(true);
    expect(chain3.mockUpdate).toHaveBeenCalledWith({
      status: 'published',
      is_public: true,
    });
    expect(chain3.mockEq).toHaveBeenCalledWith('id', 'tournament-123');
  });

  it('should return 500 on database error', async () => {
    const chain1 = makeSelectEqSingleChain({
      data: { id: 'tournament-123', status: 'draft', created_by_user_id: 'user-123' },
      error: null,
    });
    const chain2 = makeSelectCountChain(1, null);
    const chain3 = makeUpdateEqSelectSingleChain({
      data: null,
      error: { message: 'Database error' },
    });
    mockFrom
      .mockReturnValueOnce(chain1)
      .mockReturnValueOnce(chain2)
      .mockReturnValueOnce(chain3);

    const response = await publishTournament('tournament-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await publishTournament('tournament-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('大会の公開に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});
