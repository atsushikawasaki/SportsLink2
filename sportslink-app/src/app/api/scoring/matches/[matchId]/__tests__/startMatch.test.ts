import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startMatch } from '../start/startMatch';

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

describe('startMatch', () => {
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

  it('should start match successfully', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'inprogress',
      started_at: new Date().toISOString(),
    };

    mockSingle.mockResolvedValue({
      data: mockMatch,
      error: null,
    });

    const response = await startMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('inprogress');
    expect(data.started_at).toBeDefined();
    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'inprogress',
      started_at: expect.any(String),
    });
    expect(mockEq).toHaveBeenCalledWith('id', 'match-123');
  });

  it('should return 500 on database error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const response = await startMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockRejectedValue(new Error('Server error'));

    const response = await startMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の開始に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

