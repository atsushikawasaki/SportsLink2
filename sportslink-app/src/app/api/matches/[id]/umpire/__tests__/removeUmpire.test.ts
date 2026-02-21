import { describe, it, expect, vi, beforeEach } from 'vitest';
import { removeUmpire } from '../removeUmpire';

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
  isUmpire: vi.fn().mockResolvedValue(true),
  isTournamentAdmin: vi.fn().mockResolvedValue(false),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

describe('removeUmpire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const selectChain = { eq: vi.fn().mockReturnValue({ single: mockSingle }) };
    const updateChain = { eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) }) };
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      eq: mockEq,
    });
    mockSelect.mockReturnValue(selectChain);
    mockUpdate.mockReturnValue(updateChain);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await removeUmpire('match-123');
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

    mockSingle.mockResolvedValueOnce({ data: { tournament_id: 'tournament-123' }, error: null });

    const response = await removeUmpire('match-123');
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('この試合の審判を解除する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const response = await removeUmpire('match-123');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should remove umpire and return 200', async () => {
    mockSingle.mockResolvedValueOnce({ data: { tournament_id: 'tournament-123' }, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: 'match-123', umpire_id: null },
      error: null,
    });

    const response = await removeUmpire('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('審判権限を解除しました');
    expect(data.data.umpire_id).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith({ umpire_id: null });
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await removeUmpire('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('審判権限の解除に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});
