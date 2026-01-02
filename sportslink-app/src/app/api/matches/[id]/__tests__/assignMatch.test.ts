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

describe('assignMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // eq()の後にsingle()が呼ばれるチェーン
    const mockEqToSingleChain = {
      single: mockSingle,
    };
    
    // select()の後にeq()が呼ばれるチェーン
    const mockSelectChain = {
      eq: mockEq,
    };
    
    // update()の後にeq()が呼ばれるチェーン
    const mockUpdateChain = {
      eq: mockEq,
    };
    
    // eq()の後にselect()が呼ばれるチェーン（update後）
    const mockEqToSelectChain = {
      select: mockSelect,
    };
    
    // select()の後にsingle()が呼ばれるチェーン
    const mockSelectToSingleChain = {
      single: mockSingle,
    };
    
    // from()が返すオブジェクト（select()とupdate()の両方を持つ）
    const mockFromChain = {
      select: mockSelect,
      update: mockUpdate,
    };
    
    mockFrom.mockReturnValue(mockFromChain);
    mockSelect.mockReturnValue(mockSelectChain);
    mockUpdate.mockReturnValue(mockUpdateChain);
    // eq()は呼び出し元に応じて異なるチェーンを返す
    mockEq.mockImplementation((column: string) => {
      if (column === 'id') {
        // update().eq('id')の後はselect()が呼ばれる
        return mockEqToSelectChain;
      }
      // select().eq()の後はsingle()が呼ばれる
      return mockEqToSingleChain;
    });
    // select()がupdate().eq().select()の後に呼ばれた場合
    mockSelect.mockReturnValue(mockSelectToSingleChain);
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

