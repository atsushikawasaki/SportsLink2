import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmMatch } from '../confirmMatch';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
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

describe('confirmMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockQueryChain = { select: mockSelect, eq: mockEq, single: mockSingle };
    const mockUpdateChain = { eq: vi.fn().mockReturnValue({ select: mockSelect }) };
    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
    }));
    mockSelect.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
    mockUpdate.mockReturnValue(mockUpdateChain);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await confirmMatch('match-123');
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

    mockSingle.mockResolvedValueOnce({
      data: { status: 'finished', tournament_id: 'tournament-123' },
      error: null,
    });

    const response = await confirmMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('この試合を確定する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const response = await confirmMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 400 when match is not finished', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { status: 'inprogress', tournament_id: 'tournament-123' },
      error: null,
    });

    const response = await confirmMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('終了した試合のみ確定できます');
    expect(data.code).toBe('E-VER-003');
  });

  it('should confirm match and return 200', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { status: 'finished', tournament_id: 'tournament-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: { id: 'match-123', is_confirmed: true },
      error: null,
    });

    const response = await confirmMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('試合を確定しました');
    expect(data.data.is_confirmed).toBe(true);
  });

  it('should return 500 on database error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { status: 'finished', tournament_id: 'tournament-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const response = await confirmMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await confirmMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の確定に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});
