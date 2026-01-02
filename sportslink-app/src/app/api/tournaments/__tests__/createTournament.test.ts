import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTournament } from '../createTournament';

// Supabaseクライアントをモック
const mockGetUser = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();
const mockEq = vi.fn();
const mockInsertPermission = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

describe('createTournament', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // デフォルトのモック設定
    mockInsertPermission.mockResolvedValue({
      data: { id: 'permission-123' },
      error: null,
    });
    
    // mockFromはテーブル名に応じて異なるチェーンを返す
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_permissions') {
        return {
          insert: mockInsertPermission,
        };
      }
      // tournamentsテーブルの場合
      const mockInsertChain = {
        select: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      };
      return {
        insert: vi.fn().mockReturnValue(mockInsertChain),
        select: mockSelect,
      };
    });
    
    mockSelect.mockReturnValue({
      single: mockSingle,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });
  });

  it('should return 400 when name is missing', async () => {
    const request = new Request('http://localhost/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({
        description: 'Test tournament',
      }),
    });

    const response = await createTournament(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('大会名は必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new Request('http://localhost/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Tournament',
      }),
    });

    const response = await createTournament(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('ログインが必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should create tournament with default values', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    const mockTournament = {
      id: 'tournament-123',
      name: 'Test Tournament',
      description: null,
      status: 'draft',
      is_public: false,
      match_format: null,
      umpire_mode: 'LOSER',
      created_by_user_id: 'user-123',
    };

    // tournaments.insert().select().single()の結果
    mockSingle.mockResolvedValueOnce({
      data: mockTournament,
      error: null,
    });

    const request = new Request('http://localhost/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Tournament',
      }),
    });

    const response = await createTournament(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe('Test Tournament');
    expect(data.status).toBe('draft');
    expect(data.umpire_mode).toBe('LOSER');
    expect(data.is_public).toBe(false);
  });

  it('should create tournament with all fields', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    const mockTournament = {
      id: 'tournament-123',
      name: 'Test Tournament',
      description: 'Test description',
      status: 'published',
      is_public: true,
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      match_format: 'team_doubles_3',
      umpire_mode: 'ASSIGNED',
      created_by_user_id: 'user-123',
    };

    // tournaments.insert().select().single()の結果
    mockSingle.mockResolvedValueOnce({
      data: mockTournament,
      error: null,
    });

    const request = new Request('http://localhost/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Tournament',
        description: 'Test description',
        status: 'published',
        is_public: true,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        match_format: 'team_doubles_3',
        umpire_mode: 'ASSIGNED',
      }),
    });

    const response = await createTournament(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe('Test Tournament');
    expect(data.description).toBe('Test description');
    expect(data.status).toBe('published');
    expect(data.is_public).toBe(true);
    expect(data.match_format).toBe('team_doubles_3');
    expect(data.umpire_mode).toBe('ASSIGNED');
  });

  it('should return 500 on database error', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    // エラーを返すように設定
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database constraint violation' },
    });

    const request = new Request('http://localhost/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Tournament',
      }),
    });

    const response = await createTournament(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockGetUser.mockRejectedValue(new Error('Server error'));

    const request = new Request('http://localhost/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Tournament',
      }),
    });

    const response = await createTournament(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('大会の作成に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });

  it('should create tournament_admin permission for creator', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    const mockTournament = {
      id: 'tournament-123',
      name: 'Test Tournament',
      created_by_user_id: 'user-123',
    };

    // tournaments.insert().select().single()の結果
    mockSingle.mockResolvedValueOnce({
      data: mockTournament,
      error: null,
    });

    const request = new Request('http://localhost/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Tournament',
      }),
    });

    await createTournament(request);

    // user_permissionsへのinsertが呼ばれたことを確認
    expect(mockFrom).toHaveBeenCalledWith('user_permissions');
    expect(mockInsertPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        role_type: 'tournament_admin',
        tournament_id: 'tournament-123',
        team_id: null,
        match_id: null,
      })
    );
  });
});

