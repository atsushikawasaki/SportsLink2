import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignMatch } from '../assign/assignMatch';

// Supabaseクライアントをモック
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

// Admin client: from().select().eq().eq().eq().is().maybeSingle() and from().update().eq() etc.
const mockAdminFrom = vi.fn();
const resolvedPromise = Promise.resolve({ error: null });
const adminChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ error: null }),
  then: (resolve: (v: { error: null }) => void) => resolvedPromise.then(resolve),
  catch: (fn: (e: unknown) => void) => resolvedPromise.catch(fn),
};
mockAdminFrom.mockReturnValue(adminChain);

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

describe('assignMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockSelectChain = { eq: mockEq };
    const mockUpdateChain = { eq: mockEq };
    const mockSelectToSingleChain = { single: mockSingle };

    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
    });
    mockUpdate.mockReturnValue(mockUpdateChain);

    // 1回目 select(): from('matches').select() → .eq() が必要
    // 2回目 select(): update().eq().select() → .single() が必要
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount += 1;
      return selectCallCount === 1 ? mockSelectChain : mockSelectToSingleChain;
    });

    let eqCallCount = 0;
    mockEq.mockImplementation((column: string) => {
      eqCallCount += 1;
      if (column === 'id' && eqCallCount >= 2) {
        return { select: mockSelect };
      }
      return { single: mockSingle };
    });
  });

  it('should assign umpire to match', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      umpire_id: 'umpire-456',
      court_number: null,
    };

    // 最初のselect()呼び出し（match取得）
    mockSingle.mockResolvedValueOnce({
      data: { tournament_id: 'tournament-123', umpire_id: null },
      error: null,
    });
    // 2回目のselect()呼び出し（update後の取得）
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: 'umpire-456',
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.umpire_id).toBe('umpire-456');
    expect(mockUpdate).toHaveBeenCalledWith({
      umpire_id: 'umpire-456',
    });
  });

  it('should assign court number to match', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      umpire_id: null,
      court_number: 1,
    };

    // 最初のselect()呼び出し（match取得）
    mockSingle.mockResolvedValueOnce({
      data: { tournament_id: 'tournament-123', umpire_id: null },
      error: null,
    });
    // 2回目のselect()呼び出し（update後の取得）
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        court_number: 1,
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.court_number).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      court_number: 1,
    });
  });

  it('should assign both umpire and court number', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      umpire_id: 'umpire-456',
      court_number: 2,
    };

    // 最初のselect()呼び出し（match取得）
    mockSingle.mockResolvedValueOnce({
      data: { tournament_id: 'tournament-123', umpire_id: null },
      error: null,
    });
    // 2回目のselect()呼び出し（update後の取得）
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: 'umpire-456',
        court_number: 2,
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.umpire_id).toBe('umpire-456');
    expect(data.court_number).toBe(2);
    expect(mockUpdate).toHaveBeenCalledWith({
      umpire_id: 'umpire-456',
      court_number: 2,
    });
  });

  it('should handle empty body', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      umpire_id: null,
      court_number: null,
    };

    // 最初のselect()呼び出し（match取得）
    mockSingle.mockResolvedValueOnce({
      data: { tournament_id: 'tournament-123', umpire_id: null },
      error: null,
    });
    // 2回目のselect()呼び出し（update後の取得）
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should handle null values', async () => {
    const mockMatch = {
      id: 'match-123',
      tournament_id: 'tournament-123',
      umpire_id: null,
      court_number: null,
    };

    // 最初のselect()呼び出し（match取得）
    mockSingle.mockResolvedValueOnce({
      data: { tournament_id: 'tournament-123', umpire_id: 'old-umpire' },
      error: null,
    });
    // 2回目のselect()呼び出し（update後の取得）
    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: null,
        court_number: null,
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.umpire_id).toBeNull();
    expect(data.court_number).toBeNull();
  });

  it('should return 500 on database error', async () => {
    // 最初のselect()呼び出し（match取得）は成功
    mockSingle.mockResolvedValueOnce({
      data: { tournament_id: 'tournament-123', umpire_id: null },
      error: null,
    });
    // 2回目のselect()呼び出し（update後の取得）でエラー
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: 'umpire-456',
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: 'umpire-456',
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の割当に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

