import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateTournament } from '../updateTournament';

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

describe('updateTournament', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockUpdateChain = {
      eq: mockEq,
    };
    
    mockFrom.mockReturnValue({
      update: mockUpdate,
    });
    
    mockUpdate.mockReturnValue(mockUpdateChain);
    mockEq.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      single: mockSingle,
    });
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

    mockSingle.mockResolvedValue({
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

  it('should return 500 on database error', async () => {
    mockSingle.mockResolvedValue({
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
    mockFrom.mockRejectedValue(new Error('Server error'));

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

  it('should handle empty update body', async () => {
    const mockTournament = {
      id: 'tournament-123',
      name: 'Original Name',
    };

    mockSingle.mockResolvedValue({
      data: mockTournament,
      error: null,
    });

    const request = new Request('http://localhost/api/tournaments/tournament-123', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await updateTournament('tournament-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });
});

