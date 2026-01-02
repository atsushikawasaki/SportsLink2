import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishTournament } from '../publish/publishTournament';

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

describe('publishTournament', () => {
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

  it('should publish tournament successfully', async () => {
    const mockTournament = {
      id: 'tournament-123',
      name: 'Test Tournament',
      status: 'published',
      is_public: true,
    };

    mockSingle.mockResolvedValue({
      data: mockTournament,
      error: null,
    });

    const response = await publishTournament('tournament-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('published');
    expect(data.is_public).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'published',
      is_public: true,
    });
    expect(mockEq).toHaveBeenCalledWith('id', 'tournament-123');
  });

  it('should return 500 on database error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

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

