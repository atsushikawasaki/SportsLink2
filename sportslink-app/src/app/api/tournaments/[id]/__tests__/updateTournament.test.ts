import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateTournament } from '../updateTournament';

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
  isTournamentAdmin: vi.fn().mockResolvedValue(true),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

describe('updateTournament', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const selectChain = {
      eq: vi.fn().mockReturnValue({ single: mockSingle }),
    };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      update: mockUpdate,
    });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it('should update tournament successfully', async () => {
    const mockTournament = {
      id: 'tournament-123',
      name: 'Updated Tournament',
      description: 'Updated description',
      status: 'published',
    };

    mockSingle.mockResolvedValue({
      data: mockTournament,
      error: null,
    });

    const request = new Request('http://localhost/api/tournaments/tournament-123', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Updated Tournament',
        description: 'Updated description',
      }),
    });

    const response = await updateTournament('tournament-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('Updated Tournament');
    expect(data.description).toBe('Updated description');
    expect(mockEq).toHaveBeenCalledWith('id', 'tournament-123');
  });

  it('should update partial fields', async () => {
    const mockTournament = {
      id: 'tournament-123',
      name: 'Original Name',
      description: 'Updated description',
    };

    mockSingle.mockResolvedValueOnce({
      data: { id: 'tournament-123', created_by_user_id: 'user-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: mockTournament,
      error: null,
    });

    const request = new Request('http://localhost/api/tournaments/tournament-123', {
      method: 'PUT',
      body: JSON.stringify({
        description: 'Updated description',
      }),
    });

    const response = await updateTournament('tournament-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.description).toBe('Updated description');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const request = new Request('http://localhost/api/tournaments/tournament-123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    });
    const response = await updateTournament('tournament-123', request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toContain('認証が必要です');
    expect(data.code).toBe('E-AUTH-001');
  });

  it('should return 500 on database error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'tournament-123', created_by_user_id: 'user-123' },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database constraint violation' },
    });

    const request = new Request('http://localhost/api/tournaments/tournament-123', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Updated Tournament',
      }),
    });

    const response = await updateTournament('tournament-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/tournaments/tournament-123', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Updated Tournament',
      }),
    });

    const response = await updateTournament('tournament-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('大会の更新に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });

  it('should return 400 when update body is empty after validation', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'tournament-123', created_by_user_id: 'user-123' },
      error: null,
    });
    const request = new Request('http://localhost/api/tournaments/tournament-123', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await updateTournament('tournament-123', request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('更新する項目がありません');
    expect(data.code).toBe('E-VER-003');
  });
});

