import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTeam } from '../createTeam';

// Supabaseクライアントをモック
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('createTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockInsertChain = {
      select: mockSelect,
    };
    
    mockFrom.mockReturnValue({
      insert: mockInsert,
    });
    
    mockInsert.mockReturnValue(mockInsertChain);
    mockSelect.mockReturnValue({
      single: mockSingle,
    });
  });

  it('should return 400 when name is missing', async () => {
    const request = new Request('http://localhost/api/teams', {
      method: 'POST',
      body: JSON.stringify({
        tournament_id: 'tournament-123',
      }),
    });

    const response = await createTeam(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('チーム名は必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should create team successfully', async () => {
    const mockTeam = {
      id: 'team-123',
      name: 'Test Team',
      tournament_id: 'tournament-123',
      team_manager_user_id: 'user-456',
    };

    mockSingle.mockResolvedValue({
      data: mockTeam,
      error: null,
    });

    const request = new Request('http://localhost/api/teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Team',
        tournament_id: 'tournament-123',
        team_manager_user_id: 'user-456',
      }),
    });

    const response = await createTeam(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe('Test Team');
    expect(data.tournament_id).toBe('tournament-123');
  });

  it('should create team without optional fields', async () => {
    const mockTeam = {
      id: 'team-123',
      name: 'Test Team',
      tournament_id: null,
      team_manager_user_id: null,
    };

    mockSingle.mockResolvedValue({
      data: mockTeam,
      error: null,
    });

    const request = new Request('http://localhost/api/teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Team',
      }),
    });

    const response = await createTeam(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe('Test Team');
  });

  it('should return 500 on database error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database constraint violation' },
    });

    const request = new Request('http://localhost/api/teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Team',
      }),
    });

    const response = await createTeam(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Team',
      }),
    });

    const response = await createTeam(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('チームの作成に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

