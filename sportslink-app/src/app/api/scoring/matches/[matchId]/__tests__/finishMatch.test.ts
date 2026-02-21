import { describe, it, expect, vi, beforeEach } from 'vitest';
import { finishMatch } from '../finish/finishMatch';

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

vi.mock('@/lib/services/matchFlowService', () => ({
  processMatchFinish: vi.fn().mockResolvedValue(undefined),
}));

describe('finishMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockQueryChain = {
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    };
    
    const mockUpdateChain = {
      eq: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    };
    
    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
    }));
    
    mockSelect.mockReturnValue(mockQueryChain);
    mockEq.mockReturnValue(mockQueryChain);
    mockUpdate.mockReturnValue(mockUpdateChain);
  });

  it('should finish match successfully', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      status: 'inprogress',
      match_type: 'individual_match',
      tournaments: {
        id: 'tournament-123',
        umpire_mode: 'ASSIGNED',
      },
      match_scores: [],
      match_pairs: [],
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const mockUpdatedMatch = {
      id: 'match-123',
      status: 'finished',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockUpdatedMatch,
      error: null,
    });

    const response = await finishMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('finished');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await finishMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 403 when user has no permission to finish match', async () => {
    const { isUmpire, isTournamentAdmin, isAdmin } = await import('@/lib/permissions');
    vi.mocked(isUmpire).mockResolvedValueOnce(false);
    vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);

    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      status: 'inprogress',
      match_type: 'individual_match',
      tournaments: { id: 'tournament-123', umpire_mode: 'ASSIGNED' },
      match_scores: [],
      match_pairs: [],
    };
    mockSingle.mockResolvedValueOnce({ data: mockMatch, error: null });

    const response = await finishMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('この試合を終了する権限がありません');
    expect(data.code).toBe('E-AUTH-002');
  });

  it('should return 400 when request body is invalid JSON', async () => {
    const invalidRequest = new Request('http://localhost/api/finish', {
      method: 'POST',
      body: 'not json',
    });
    const response = await finishMatch('match-123', invalidRequest);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('不正なJSON');
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const response = await finishMatch('nonexistent-match');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should process match finish flow', async () => {
    const { processMatchFinish } = await import('@/lib/services/matchFlowService');

    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      status: 'inprogress',
      match_type: 'individual_match',
      tournaments: {
        id: 'tournament-123',
        umpire_mode: 'ASSIGNED',
      },
      match_scores: [],
      match_pairs: [],
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: { id: 'match-123', status: 'finished' },
      error: null,
    });

    await finishMatch('match-123');

    expect(processMatchFinish).toHaveBeenCalledWith('match-123');
  });

  it('should return 500 on database error when updating status', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      status: 'inprogress',
      match_type: 'individual_match',
      tournaments: {
        id: 'tournament-123',
        umpire_mode: 'ASSIGNED',
      },
      match_scores: [],
      match_pairs: [],
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const response = await finishMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await finishMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の終了に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });

  it('should return 500 when processMatchFinish throws', async () => {
    const { processMatchFinish } = await import('@/lib/services/matchFlowService');
    vi.mocked(processMatchFinish).mockRejectedValueOnce(new Error('Could not determine winner'));

    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      status: 'inprogress',
      match_type: 'individual_match',
      tournaments: { id: 'tournament-123', umpire_mode: 'ASSIGNED' },
      match_scores: [],
      match_pairs: [],
    };

    mockSingle.mockResolvedValueOnce({ data: mockMatch, error: null });

    const response = await finishMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-SERVER-001');
  });
});

