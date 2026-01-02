import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resumeMatch } from '../resume/resumeMatch';

// Supabaseクライアントをモック
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('resumeMatch', () => {
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
    mockSelect.mockReturnValue({
      single: mockSingle,
    });
  });

  it('should resume paused match successfully', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'paused',
    };

    const mockResumedMatch = {
      id: 'match-123',
      status: 'inprogress',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: mockResumedMatch,
      error: null,
    });

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('試合を再開しました');
    expect(data.match_id).toBe('match-123');
    expect(data.match.status).toBe('inprogress');
  });

  it('should return 404 when match not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const response = await resumeMatch('nonexistent-match');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('試合が見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return 400 when match is not paused', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'inprogress',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('中断中の試合のみ再開できます');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when match is finished', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'finished',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('中断中の試合のみ再開できます');
  });

  it('should return 500 on database error when updating', async () => {
    const mockMatch = {
      id: 'match-123',
      status: 'paused',
    };

    mockSingle.mockResolvedValueOnce({
      data: mockMatch,
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の再開に失敗しました');
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockRejectedValue(new Error('Server error'));

    const response = await resumeMatch('match-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の再開に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

